// itemsRoutes.js - Item Sales Report Endpoints for Phin Cafe Reports

import { DateTime } from "luxon";
import { SquareError } from "square";

import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY || null;
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;


/**
 * Call this from your main index.js:
 *   import { registerItemRoutes } from "./itemsRoutes.js";
 *   ...
 *   registerItemRoutes(app, client);
 */
export function registerItemRoutes(app, client) {
  /**
   * Helper: build simple human-readable insights string
   * for a given item list + totals.
   */
    /**
   * Helper: build human-readable insights string
   * First tries OpenAI (if API key present), falls back to rule-based text.
   */
  async function buildSimpleInsights({ scopeLabel, dateLabel, items, total }) {
    // Fallback if no data
    if (!items || items.length === 0) {
      return `No item sales found for ${scopeLabel} on ${dateLabel}.`;
    }

    const topItems = items.slice(0, 5);
    const topItem = topItems[0];

    const topTotal = topItems.reduce((sum, it) => sum + it.total, 0);
    const topPct = total > 0 ? (topTotal / total) * 100 : 0;

    const topListText = topItems
      .map(
        (it, idx) =>
          `${idx + 1}. ${it.itemName} (${it.quantity} sold, $${it.total.toFixed(
            2
          )})`
      )
      .join("; ");

    const fallback = [
      `On ${dateLabel} at ${scopeLabel}, estimated item revenue was $${total.toFixed(
        2
      )}.`,
      `Your top seller was ${topItem.itemName} with ${topItem.quantity} sold and $${topItem.total.toFixed(
        2
      )} in sales.`,
      `The top ${topItems.length} items contributed about ${topPct.toFixed(
        1
      )}% of total item revenue.`,
      `Top items: ${topListText}.`,
    ].join(" ");

    // If OpenAI is not configured, just return the fallback
    if (!openaiClient) {
      return fallback;
    }

    try {
      const prompt = [
        `You are a data analyst for a multi-location Vietnamese coffee shop brand named Phin Cafe.`,
        `Write a short, friendly insight for the owner based on these stats.`,
        ``,
        `Scope: ${scopeLabel}`,
        `Date or Range: ${dateLabel}`,
        `Total item revenue: $${total.toFixed(2)}`,
        ``,
        `Top items:`,
        topItems
          .map(
            (it, idx) =>
              `${idx + 1}. ${it.itemName} – qty ${it.quantity}, $${it.total.toFixed(
                2
              )}`
          )
          .join("\n"),
        ``,
        `The top ${topItems.length} items contribute about ${topPct.toFixed(
          1
        )}% of revenue.`,
        ``,
        `Write 3–5 sentences.`,
        `Focus on:`,
        `- What items are driving sales (especially signature drinks like Egg Coffee, Coconut Coffee, Salted Coffee, etc.)`,
        `- Any balance between drinks vs food (banh mi, musubi, pastries) if visible`,
        `- A gentle suggestion that might help operations or marketing (e.g. feature a top drink, check stock for a strong seller).`,
        `Do NOT talk about missing data or limitations. Sound confident, helpful, and business-focused.`,
      ].join("\n");

      const response = await openaiClient.responses.create({
        model: "gpt-4.1-mini",
        input: prompt,
      });

      const aiText =
        response.output?.[0]?.content?.[0]?.text?.trim() || fallback;

      return aiText;
    } catch (err) {
      console.error("OpenAI error in buildSimpleInsights:", err);
      return fallback;
    }
  }


  /**
   * GET /api/itemsales?locationId=...&date=YYYY-MM-DD
   * Item-level sales for a single location, merging all variations.
   * Uses CREATED_AT and the same normalization logic as aggregate reports.
   */
  app.get("/api/itemsales", async (req, res) => {
    const locationId = req.query.locationId;
    const dateStr = req.query.date;
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!locationId) {
      return res.status(400).json({ error: "Missing locationId" });
    }
    if (!dateStr) {
      return res.status(400).json({ error: "Missing date=YYYY-MM-DD" });
    }

    try {
      const start = DateTime.fromISO(dateStr, { zone: timezone }).startOf("day");
      const end = start.endOf("day");

      if (!start.isValid) {
        return res.status(400).json({ error: "Invalid date" });
      }

      const beginTime = start.toUTC().toISO();
      const endTime = end.toUTC().toISO();

      // Fetch orders for that location + day using CREATED_AT
      const ordersResponse = await client.orders.search({
        locationIds: [locationId],
        query: {
          filter: {
            dateTimeFilter: {
              createdAt: {
                startAt: beginTime,
                endAt: endTime,
              },
            },
            // No stateFilter here so it matches your original itemsales behavior
          },
          sort: {
            sortField: "CREATED_AT",
            sortOrder: "ASC",
          },
        },
      });

      const orders = ordersResponse.orders || [];

      // Group items
      const itemMap = new Map();

      for (const order of orders) {
        if (!order.lineItems) continue;

        for (const li of order.lineItems) {
          const rawName = li.name || "Unnamed item";
          const name = normalizeItemName(rawName);

          const qty = li.quantity ? parseFloat(li.quantity) : 0;

          const rawMoney =
            li.grossSalesMoney?.amount ??
            li.totalMoney?.amount ??
            0n;

          const amountCents =
            typeof rawMoney === "bigint"
              ? Number(rawMoney)
              : Number(rawMoney || 0);

          if (!itemMap.has(name)) {
            itemMap.set(name, {
              itemName: name,
              quantity: 0,
              totalCents: 0,
            });
          }

          const item = itemMap.get(name);
          item.quantity += qty;
          item.totalCents += amountCents;
        }
      }

      const items = [...itemMap.values()].map((i) => {
        const total = i.totalCents / 100;
        return {
          itemName: i.itemName,
          quantity: i.quantity,
          total,
          totalFormatted: total.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          }),
        };
      });

      // Sort by total descending
      items.sort((a, b) => b.total - a.total);

      res.json({
        locationId,
        date: dateStr,
        timezone,
        totalItems: items.length,
        items,
      });
    } catch (err) {
      console.error("Item sales error:", err);
      res.status(500).json({
        error: "Item sales endpoint failed",
        details: err.message,
      });
    }
  });

  /**
   * DAILY item sales (all locations)
   * GET /api/items/daily?date=YYYY-MM-DD
   * Uses the same CREATED_AT logic and normalization as /api/itemsales.
   */
  app.get("/api/items/daily", async (req, res) => {
    const dateStr = req.query.date;
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!dateStr) {
      return res.status(400).json({ error: "Missing date=YYYY-MM-DD" });
    }

    try {
      const start = DateTime.fromISO(dateStr, { zone: timezone }).startOf("day");
      const end = start.endOf("day");

      if (!start.isValid) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const beginTime = start.toUTC().toISO();
      const endTime = end.toUTC().toISO();

      const agg = await aggregateItemSalesForRange(beginTime, endTime, client);

      res.json({
        type: "daily",
        date: dateStr,
        timezone,
        grandTotal: agg.grandTotal,
        grandTotalFormatted: agg.grandTotal.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
        overallItems: agg.overallItems,
        locations: agg.perLocation,
      });
    } catch (err) {
      console.error("Error fetching item sales (daily):", err);

      if (err instanceof SquareError) {
        return res.status(502).json({
          error: "Square API error",
          details: err.body,
        });
      }

      res.status(500).json({ error: "Unexpected server error" });
    }
  });

  /**
   * WEEKLY item sales (all locations)
   * GET /api/items/weekly?week=YYYY-MM-DD
   *   - week= is any date within the week you want
   */
  app.get("/api/items/weekly", async (req, res) => {
    const weekStr = req.query.week;
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!weekStr) {
      return res.status(400).json({ error: "Missing week=YYYY-MM-DD" });
    }

    try {
      const target = DateTime.fromISO(weekStr, { zone: timezone });
      if (!target.isValid) {
        return res.status(400).json({ error: "Invalid week date" });
      }

      const start = target.startOf("week");
      const end = target.endOf("week");

      const beginTime = start.toUTC().toISO();
      const endTime = end.toUTC().toISO();

      const agg = await aggregateItemSalesForRange(beginTime, endTime, client);

      res.json({
        type: "weekly",
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        timezone,
        grandTotal: agg.grandTotal,
        grandTotalFormatted: agg.grandTotal.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
        overallItems: agg.overallItems,
        locations: agg.perLocation,
      });
    } catch (err) {
      console.error("Error fetching item sales (weekly):", err);

      if (err instanceof SquareError) {
        return res.status(502).json({
          error: "Square API error",
          details: err.body,
        });
      }

      res.status(500).json({ error: "Unexpected server error" });
    }
  });

  /**
   * MONTHLY item sales (all locations)
   * GET /api/items/monthly?month=YYYY-MM
   */
  app.get("/api/items/monthly", async (req, res) => {
    const monthStr = req.query.month; // YYYY-MM
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!monthStr) {
      return res.status(400).json({ error: "Missing month=YYYY-MM" });
    }

    try {
      const start = DateTime.fromISO(monthStr + "-01", {
        zone: timezone,
      }).startOf("month");

      if (!start.isValid) {
        return res.status(400).json({ error: "Invalid month format" });
      }

      const end = start.endOf("month");

      const beginTime = start.toUTC().toISO();
      const endTime = end.toUTC().toISO();

      const agg = await aggregateItemSalesForRange(beginTime, endTime, client);

      res.json({
        type: "monthly",
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        timezone,
        grandTotal: agg.grandTotal,
        grandTotalFormatted: agg.grandTotal.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
        overallItems: agg.overallItems,
        locations: agg.perLocation,
      });
    } catch (err) {
      console.error("Error fetching item sales (monthly):", err);

      if (err instanceof SquareError) {
        return res.status(502).json({
          error: "Square API error",
          details: err.body,
        });
      }

      res.status(500).json({ error: "Unexpected server error" });
    }
  });
  /**
   * YEARLY item sales (all locations)
   * GET /api/items/yearly?year=YYYY
   */
  app.get("/api/items/yearly", async (req, res) => {
    const yearStr = req.query.year; // e.g. 2025
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!yearStr) {
      return res.status(400).json({ error: "Missing year=YYYY" });
    }

    try {
      const year = parseInt(yearStr, 10);
      if (isNaN(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "Invalid year format" });
      }

      const start = DateTime.fromObject(
        { year, month: 1, day: 1 },
        { zone: timezone }
      ).startOf("year");
      const end = start.endOf("year");

      const beginTime = start.toUTC().toISO();
      const endTime = end.toUTC().toISO();

      const agg = await aggregateItemSalesForRange(beginTime, endTime, client);

      res.json({
        type: "yearly",
        year,
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        timezone,
        grandTotal: agg.grandTotal,
        grandTotalFormatted: agg.grandTotal.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
        overallItems: agg.overallItems,
        locations: agg.perLocation,
      });
    } catch (err) {
      console.error("Error fetching item sales (yearly):", err);

      if (err instanceof SquareError) {
        return res.status(502).json({
          error: "Square API error",
          details: err.body,
        });
      }

      res.status(500).json({ error: "Unexpected server error" });
    }
  });

  // =========================
  // AI-STYLE INSIGHT ENDPOINTS
  // =========================

  /**
   * DAILY AI-style insights
   * GET /api/items/insights/daily?date=YYYY-MM-DD&locationId=optional
   */
  app.get("/api/items/insights/daily", async (req, res) => {
    const dateStr = req.query.date;
    const locationId = req.query.locationId || null;
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!dateStr) {
      return res.status(400).json({ error: "Missing date=YYYY-MM-DD" });
    }

    try {
      const start = DateTime.fromISO(dateStr, { zone: timezone }).startOf("day");
      const end = start.endOf("day");

      if (!start.isValid) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const beginTime = start.toUTC().toISO();
      const endTime = end.toUTC().toISO();

      const agg = await aggregateItemSalesForRange(beginTime, endTime, client);

      let scopeLabel = "All Locations";
      let itemsForScope = agg.overallItems;
      let totalForScope = agg.grandTotal;

      if (locationId) {
        const loc = agg.perLocation.find((l) => l.locationId === locationId);
        if (!loc) {
          return res.status(404).json({
            error: "Location not found in results",
            locationId,
          });
        }
        scopeLabel = loc.locationName || locationId;
        itemsForScope = loc.items;
        totalForScope = loc.total;
      }

      const insightsText = await buildSimpleInsights({
        scopeLabel,
        dateLabel: dateStr,
        items: itemsForScope,
        total: totalForScope,
      });

      res.json({
        type: "daily-insights",
        date: dateStr,
        timezone,
        scope: {
          locationId: locationId || "ALL",
          label: scopeLabel,
        },
        grandTotal: totalForScope,
        grandTotalFormatted: totalForScope.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
        items: itemsForScope,
        insights: insightsText,
      });
    } catch (err) {
      console.error("Error building daily item insights:", err);
      res.status(500).json({ error: "Unexpected server error" });
    }
  });

  /**
   * WEEKLY AI-style insights
   * GET /api/items/insights/weekly?week=YYYY-MM-DD&locationId=optional
   */
  app.get("/api/items/insights/weekly", async (req, res) => {
    const weekStr = req.query.week;
    const locationId = req.query.locationId || null;
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!weekStr) {
      return res.status(400).json({ error: "Missing week=YYYY-MM-DD" });
    }

    try {
      const target = DateTime.fromISO(weekStr, { zone: timezone });
      if (!target.isValid) {
        return res.status(400).json({ error: "Invalid week date" });
      }

      const start = target.startOf("week");
      const end = target.endOf("week");

      const beginTime = start.toUTC().toISO();
      const endTime = end.toUTC().toISO();

      const agg = await aggregateItemSalesForRange(beginTime, endTime, client);

      let scopeLabel = "All Locations";
      let itemsForScope = agg.overallItems;
      let totalForScope = agg.grandTotal;

      if (locationId) {
        const loc = agg.perLocation.find((l) => l.locationId === locationId);
        if (!loc) {
          return res.status(404).json({
            error: "Location not found in results",
            locationId,
          });
        }
        scopeLabel = loc.locationName || locationId;
        itemsForScope = loc.items;
        totalForScope = loc.total;
      }

      const dateLabel = `${start.toISODate()} to ${end.toISODate()}`;
      const insightsText = await buildSimpleInsights({
        scopeLabel,
        dateLabel,
        items: itemsForScope,
        total: totalForScope,
      });

      res.json({
        type: "weekly-insights",
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        timezone,
        scope: {
          locationId: locationId || "ALL",
          label: scopeLabel,
        },
        grandTotal: totalForScope,
        grandTotalFormatted: totalForScope.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
        items: itemsForScope,
        insights: insightsText,
      });
    } catch (err) {
      console.error("Error building weekly item insights:", err);
      res.status(500).json({ error: "Unexpected server error" });
    }
  });

  /**
   * MONTHLY AI-style insights
   * GET /api/items/insights/monthly?month=YYYY-MM&locationId=optional
   */
  app.get("/api/items/insights/monthly", async (req, res) => {
    const monthStr = req.query.month;
    const locationId = req.query.locationId || null;
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!monthStr) {
      return res.status(400).json({ error: "Missing month=YYYY-MM" });
    }

    try {
      const start = DateTime.fromISO(monthStr + "-01", {
        zone: timezone,
      }).startOf("month");
      if (!start.isValid) {
        return res.status(400).json({ error: "Invalid month format" });
      }
      const end = start.endOf("month");

      const beginTime = start.toUTC().toISO();
      const endTime = end.toUTC().toISO();

      const agg = await aggregateItemSalesForRange(beginTime, endTime, client);

      let scopeLabel = "All Locations";
      let itemsForScope = agg.overallItems;
      let totalForScope = agg.grandTotal;

      if (locationId) {
        const loc = agg.perLocation.find((l) => l.locationId === locationId);
        if (!loc) {
          return res.status(404).json({
            error: "Location not found in results",
            locationId,
          });
        }
        scopeLabel = loc.locationName || locationId;
        itemsForScope = loc.items;
        totalForScope = loc.total;
      }

      const dateLabel = `${start.toISODate()} to ${end.toISODate()}`;
      const insightsText = await buildSimpleInsights({
        scopeLabel,
        dateLabel,
        items: itemsForScope,
        total: totalForScope,
      });

      res.json({
        type: "monthly-insights",
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        timezone,
        scope: {
          locationId: locationId || "ALL",
          label: scopeLabel,
        },
        grandTotal: totalForScope,
        grandTotalFormatted: totalForScope.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
        items: itemsForScope,
        insights: insightsText,
      });
    } catch (err) {
      console.error("Error building monthly item insights:", err);
      res.status(500).json({ error: "Unexpected server error" });
    }
  });
}

/**
 * Shared helper: aggregate item sales across a time range (UTC ISO strings)
 * Uses Orders API search, across ALL locations, and returns:
 *  - grandTotal
 *  - overallItems[] (all locations combined)
 *  - perLocation[] with items[] per location
 *
 * IMPORTANT: uses CREATED_AT to align with /api/itemsales
 */
async function aggregateItemSalesForRange(beginTime, endTime, client) {
  // 1) Get all locations
  const locationsResp = await client.locations.list();
  const locations = locationsResp.locations || [];
  const locationMap = new Map(
    locations.map((loc) => [loc.id, loc.name || loc.id])
  );

  // 2) Base Orders search body – using CREATED_AT
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
        // No stateFilter so it matches /api/itemsales behavior
      },
      sort: {
        sortField: "CREATED_AT",
        sortOrder: "ASC",
      },
    },
  };

  const perLocationItems = new Map(); // locId -> { locationId, locationName, itemsMap }
  const overallItems = new Map(); // key -> { itemName, catalogObjectId, quantity, totalCents }

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

      if (!perLocationItems.has(locId)) {
        perLocationItems.set(locId, {
          locationId: locId,
          locationName: locName,
          itemsMap: new Map(),
        });
      }

      const locBucket = perLocationItems.get(locId);
      const lineItems = order.lineItems || [];

      for (const li of lineItems) {
        const rawName = li.name || "Unnamed item";
        const itemName = normalizeItemName(rawName); // combine variations
        const catalogObjectId = li.catalogObjectId || null;

        // group key: base name only so Egg Coffee (Hot/Cold/Large) combine
        const key = itemName.toLowerCase();

        const qty = li.quantity ? parseFloat(li.quantity) : 0;

        const rawMoney =
          li.grossSalesMoney?.amount ??
          li.totalMoney?.amount ??
          0n;
        const amountCents =
          typeof rawMoney === "bigint"
            ? Number(rawMoney)
            : Number(rawMoney || 0);

        // per-location bucket
        if (!locBucket.itemsMap.has(key)) {
          locBucket.itemsMap.set(key, {
            itemName,
            catalogObjectId, // first seen variation
            quantity: 0,
            totalCents: 0,
          });
        }
        const locItem = locBucket.itemsMap.get(key);
        locItem.quantity += qty;
        locItem.totalCents += amountCents;

        // global bucket
        if (!overallItems.has(key)) {
          overallItems.set(key, {
            itemName,
            catalogObjectId,
            quantity: 0,
            totalCents: 0,
          });
        }
        const overallItem = overallItems.get(key);
        overallItem.quantity += qty;
        overallItem.totalCents += amountCents;
      }
    }
  } while (cursor);

  // per-location array
  const perLocationArray = [];
  for (const [locId, locBucket] of perLocationItems.entries()) {
    const itemsArray = Array.from(locBucket.itemsMap.values()).map((i) => {
      const total = i.totalCents / 100;
      return {
        itemName: i.itemName,
        catalogObjectId: i.catalogObjectId,
        quantity: i.quantity,
        total,
        totalFormatted: total.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
      };
    });

    itemsArray.sort((a, b) => b.total - a.total);

    const locationTotal = itemsArray.reduce((sum, it) => sum + it.total, 0);

    perLocationArray.push({
      locationId: locBucket.locationId,
      locationName: locBucket.locationName,
      total: locationTotal,
      totalFormatted: locationTotal.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      }),
      items: itemsArray,
    });
  }

  // overall array
  const overallArray = Array.from(overallItems.values()).map((i) => {
    const total = i.totalCents / 100;
    return {
      itemName: i.itemName,
      catalogObjectId: i.catalogObjectId,
      quantity: i.quantity,
      total,
      totalFormatted: total.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      }),
    };
  });

  overallArray.sort((a, b) => b.total - a.total);

  const grandTotal = overallArray.reduce((sum, it) => sum + it.total, 0);

  return {
    grandTotal,
    overallItems: overallArray,
    perLocation: perLocationArray,
  };
}

/**
 * Normalize item names so variations like:
 *  - "Egg Coffee (Hot)"
 *  - "Egg Coffee (Cold)"
 *  - "Egg Coffee - Large"
 *  all become simply "Egg Coffee".
 */
function normalizeItemName(rawName) {
  if (!rawName) return "Unnamed item";

  let name = rawName.trim();

  // Strip trailing parentheses: "Egg Coffee (Hot)" -> "Egg Coffee"
  name = name.replace(/\s*\([^)]*\)\s*$/g, "");

  // Strip common size/temp suffixes like " - Large", " - Small", " - Hot", " - Cold", " - Iced"
  name = name.replace(
    /\s*-\s*(small|medium|large|hot|cold|iced)$/i,
    ""
  );

  return name.trim();
}
