// hourlyRoutes.js - Hourly Heatmap + AI Insights for Phin Cafe

import { DateTime } from "luxon";
import { SquareError } from "square";
import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY || null;
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

/**
 * Call this from your main index.js:
 *   import { registerHourlyRoutes } from "./hourlyRoutes.js";
 *   ...
 *   registerHourlyRoutes(app, client);
 */
export function registerHourlyRoutes(app, client) {
  const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

  /**
   * Core helper: aggregate hourly sales for a single date (all locations)
   * Returns:
   * {
   *   date,
   *   timezone,
   *   grandTotal,
   *   grandTotalFormatted,
   *   buckets: [ { hour, label, total, totalFormatted } ],
   *   locations: [
   *     {
   *       locationId,
   *       locationName,
   *       total,
   *       totalFormatted,
   *       buckets: [ { hour, label, total, totalFormatted } ]
   *     }
   *   ]
   * }
   */
  async function aggregateHourlyForDate(dateStr) {
    const start = DateTime.fromISO(dateStr, { zone: timezone }).startOf("day");
    const end = start.endOf("day");

    if (!start.isValid) {
      throw new Error("Invalid date format for hourly report");
    }

    const beginTime = start.toUTC().toISO();
    const endTime = end.toUTC().toISO();

    // 1) Get all locations
    const locationsResp = await client.locations.list();
    const locations = locationsResp.locations || [];
    const locationMap = new Map(
      locations.map((loc) => [loc.id, loc.name || loc.id])
    );

    // 2) Prepare buckets: 0–23 hours
    function makeEmptyBuckets() {
      const arr = [];
      for (let h = 0; h < 24; h++) {
        const label = `${String(h).padStart(2, "0")}:00`;
        arr.push({
          hour: h,
          label,
          totalCents: 0,
        });
      }
      return arr;
    }

    const overallBuckets = makeEmptyBuckets();
    const perLocationBuckets = new Map(); // locId -> { locationId, locationName, buckets }

    // 3) Base Orders search body – using CREATED_AT
    const baseSearchBody = {
      locationIds: locations.map((loc) => loc.id),
      query: {
        filter: {
          dateTimeFilter: {
            createdAt: {
              startAt: beginTime,
              endAt: endTime,
            },
          },
          // keep stateFilter loose to match other reports
        },
        sort: {
          sortField: "CREATED_AT",
          sortOrder: "ASC",
        },
      },
    };

    let cursor = undefined;

    do {
      const body = cursor ? { ...baseSearchBody, cursor } : baseSearchBody;
      const resp = await client.orders.search(body);
      const orders = resp.orders || [];
      cursor = resp.cursor;

      for (const order of orders) {
        if (!order) continue;

        const locId = order.locationId || "UNKNOWN";
        const locName = locationMap.get(locId) || locId;

        if (!perLocationBuckets.has(locId)) {
          perLocationBuckets.set(locId, {
            locationId: locId,
            locationName: locName,
            buckets: makeEmptyBuckets(),
          });
        }

        const createdAt = order.createdAt || order.closedAt || null;
        if (!createdAt) continue;

        const dt = DateTime.fromISO(createdAt, { zone: timezone });
        if (!dt.isValid) continue;
        const hour = dt.hour; // 0–23

        const orderLineItems = order.lineItems || [];
        let orderTotalCents = 0;

        for (const li of orderLineItems) {
          const rawMoney =
            li.grossSalesMoney?.amount ??
            li.totalMoney?.amount ??
            0n;
          const cents =
            typeof rawMoney === "bigint"
              ? Number(rawMoney)
              : Number(rawMoney || 0);
          orderTotalCents += cents;
        }

        if (orderTotalCents <= 0) continue;

        // overall
        overallBuckets[hour].totalCents += orderTotalCents;

        // per location
        const locBucket = perLocationBuckets.get(locId);
        locBucket.buckets[hour].totalCents += orderTotalCents;
      }
    } while (cursor);

    // final formatting
    const overall = overallBuckets.map((b) => {
      const total = b.totalCents / 100;
      return {
        hour: b.hour,
        label: b.label,
        total,
        totalFormatted: total.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
      };
    });

    const locationsArr = [];
    let grandTotal = 0;

    for (const [locId, locData] of perLocationBuckets.entries()) {
      const buckets = locData.buckets.map((b) => {
        const total = b.totalCents / 100;
        return {
          hour: b.hour,
          label: b.label,
          total,
          totalFormatted: total.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          }),
        };
      });

      const locTotal = buckets.reduce((sum, b) => sum + b.total, 0);
      grandTotal += locTotal;

      locationsArr.push({
        locationId: locData.locationId,
        locationName: locData.locationName,
        total: locTotal,
        totalFormatted: locTotal.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
        buckets,
      });
    }

    const grandTotalFormatted = grandTotal.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    return {
      type: "hourly",
      date: start.toISODate(),
      timezone,
      grandTotal,
      grandTotalFormatted,
      buckets: overall,
      locations: locationsArr,
    };
  }

  // ==================
  // BASE HOURLY ROUTE
  // ==================
  // GET /api/hourly?date=YYYY-MM-DD
  app.get("/api/hourly", async (req, res) => {
    const dateStr = req.query.date;
    if (!dateStr) {
      return res.status(400).json({ error: "Missing date=YYYY-MM-DD" });
    }

    try {
      const result = await aggregateHourlyForDate(dateStr);
      res.json(result);
    } catch (err) {
      console.error("Error in /api/hourly:", err);

      if (err instanceof SquareError) {
        return res.status(502).json({
          error: "Square API error",
          details: err.body,
        });
      }
      res.status(500).json({ error: "Unexpected server error" });
    }
  });

  // ===========================
  // AI INSIGHTS FOR HOURLY
  // ===========================

  async function buildHourlyInsights({
    scopeLabel,
    dateLabel,
    buckets,
    grandTotal,
  }) {
    if (!buckets || buckets.length === 0) {
      return `No hourly sales data for ${scopeLabel} on ${dateLabel}.`;
    }

    // find top 3 hours
    const sorted = [...buckets].sort((a, b) => b.total - a.total);
    const top = sorted.slice(0, 3);
    const topTotal = top.reduce((s, h) => s + h.total, 0);
    const topPct = grandTotal > 0 ? (topTotal / grandTotal) * 100 : 0;

    const fallback = [
      `On ${dateLabel} at ${scopeLabel}, total sales were $${grandTotal.toFixed(
        2
      )}.`,
      `The busiest hour was ${top[0].label} with about $${top[0].total.toFixed(
        2
      )} in sales.`,
      `Your top ${top.length} hours contributed roughly ${topPct.toFixed(
        1
      )}% of the day's revenue.`,
      `These peaks are strong candidates for staffing and prep focus.`,
    ].join(" ");

    if (!openaiClient) {
      return fallback;
    }

    try {
      const hoursText = sorted
        .map(
          (h) => `${h.label} – $${h.total.toFixed(2)}`
        )
        .join("\n");

      const prompt = [
        `You are a data analyst for a multi-location Vietnamese coffee shop brand named Phin Cafe.`,
        `You are analyzing hourly sales for a single day.`,
        ``,
        `Scope: ${scopeLabel}`,
        `Date: ${dateLabel}`,
        `Total sales: $${grandTotal.toFixed(2)}`,
        ``,
        `Hourly breakdown (local time):`,
        hoursText,
        ``,
        `Write 3–5 short sentences:`,
        `- Identify the busiest hours and approximate share of revenue.`,
        `- Comment on whether the pattern is morning-heavy, afternoon-heavy, or evening-heavy.`,
        `- Suggest at least one operational or marketing action (staffing, batching, promos, happy hour timing, etc.).`,
        `Do NOT mention missing data or model limitations. Sound confident and pragmatic.`,
      ].join("\n");

      const response = await openaiClient.responses.create({
        model: "gpt-4.1-mini",
        input: prompt,
      });

      const aiText =
        response.output?.[0]?.content?.[0]?.text?.trim() || fallback;

      return aiText;
    } catch (err) {
      console.error("OpenAI error in hourly insights:", err);
      return fallback;
    }
  }

  /**
   * GET /api/hourly/insights?date=YYYY-MM-DD&locationId=optional
   */
  app.get("/api/hourly/insights", async (req, res) => {
    const dateStr = req.query.date;
    const locationId = req.query.locationId || "ALL";

    if (!dateStr) {
      return res.status(400).json({ error: "Missing date=YYYY-MM-DD" });
    }

    try {
      const agg = await aggregateHourlyForDate(dateStr);

      let scopeLabel = "All locations";
      let bucketsForScope = agg.buckets;
      let totalForScope = agg.grandTotal;

      if (locationId !== "ALL") {
        const loc = (agg.locations || []).find(
          (l) => l.locationId === locationId
        );
        if (!loc) {
          return res.status(404).json({
            error: "Location not found in hourly results",
            locationId,
          });
        }
        scopeLabel = loc.locationName || locationId;
        bucketsForScope = loc.buckets;
        totalForScope = loc.total;
      }

      const dateLabel = agg.date;
      const insights = await buildHourlyInsights({
        scopeLabel,
        dateLabel,
        buckets: bucketsForScope,
        grandTotal: totalForScope,
      });

      res.json({
        type: "hourly-insights",
        date: agg.date,
        timezone: agg.timezone,
        scope: {
          locationId,
          label: scopeLabel,
        },
        grandTotal: totalForScope,
        grandTotalFormatted: totalForScope.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
        insights,
      });
    } catch (err) {
      console.error("Error in /api/hourly/insights:", err);
      res.status(500).json({ error: "Unexpected server error" });
    }
  });
}
