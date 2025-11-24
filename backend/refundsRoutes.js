// refundsRoutes.js - Refund Reports for Phin Cafe Dashboard

import { DateTime } from "luxon";
import { SquareError } from "square";

/**
 * Call this from your main index.js:
 *   import { registerRefundRoutes } from "./refundsRoutes.js";
 *   ...
 *   registerRefundRoutes(app, client);
 */
export function registerRefundRoutes(app, client) {
  const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

  /**
   * DAILY refunds
   * GET /api/refunds?date=YYYY-MM-DD
   */
  app.get("/api/refunds", async (req, res) => {
    const dateStr = req.query.date;
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

      const agg = await aggregateRefundsForRange(beginTime, endTime, client);

      res.json({
        type: "daily-refunds",
        date: dateStr,
        timezone,
        grandTotal: agg.grandTotal,
        grandTotalFormatted: agg.grandTotal.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        }),
        grandCount: agg.grandCount,
        locationsCount: agg.locations.length,
        locations: agg.locations,
      });
    } catch (err) {
      console.error("Error fetching daily refunds:", err);

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
   * WEEKLY refunds
   * GET /api/refunds/weekly?week=YYYY-MM-DD
   *   - week= is any date within the week you want
   */
  app.get("/api/refunds/weekly", async (req, res) => {
    const weekStr = req.query.week;
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

      const agg = await aggregateRefundsForRange(beginTime, endTime, client);

      res.json({
        type: "weekly-refunds",
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
        grandCount: agg.grandCount,
        locationsCount: agg.locations.length,
        locations: agg.locations,
      });
    } catch (err) {
      console.error("Error fetching weekly refunds:", err);

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
   * MONTHLY refunds
   * GET /api/refunds/monthly?month=YYYY-MM
   */
  app.get("/api/refunds/monthly", async (req, res) => {
    const monthStr = req.query.month; // YYYY-MM
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

      const agg = await aggregateRefundsForRange(beginTime, endTime, client);

      res.json({
        type: "monthly-refunds",
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
        grandCount: agg.grandCount,
        locationsCount: agg.locations.length,
        locations: agg.locations,
      });
    } catch (err) {
      console.error("Error fetching monthly refunds:", err);

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
   * YEARLY refunds
   * GET /api/refunds/yearly?year=YYYY
   */
  app.get("/api/refunds/yearly", async (req, res) => {
    const yearStr = req.query.year; // "2025"
    if (!yearStr) {
      return res.status(400).json({ error: "Missing year=YYYY" });
    }

    try {
      const start = DateTime.fromISO(`${yearStr}-01-01`, {
        zone: timezone,
      }).startOf("year");

      if (!start.isValid) {
        return res.status(400).json({ error: "Invalid year format" });
      }

      const end = start.endOf("year");

      const beginTime = start.toUTC().toISO();
      const endTime = end.toUTC().toISO();

      const agg = await aggregateRefundsForRange(beginTime, endTime, client);

      res.json({
        type: "yearly-refunds",
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
        grandCount: agg.grandCount,
        locationsCount: agg.locations.length,
        locations: agg.locations,
      });
    } catch (err) {
      console.error("Error fetching yearly refunds:", err);

      if (err instanceof SquareError) {
        return res.status(502).json({
          error: "Square API error",
          details: err.body,
        });
      }

      res.status(500).json({ error: "Unexpected server error" });
    }
  });
}

/**
 * Shared helper: per-location refund aggregation for a time range.
 * Uses the same pattern as your working server file:
 *   - client.refunds.list({ ... }) returns an async iterable
 *   - we loop with for await (...)
 */
async function aggregateRefundsForLocation(beginTime, endTime, client, locationId) {
  const refundsIterable = await client.refunds.list({
    beginTime,
    endTime,
    sortOrder: "ASC",
    locationId,
  });

  let totalCents = 0;
  let count = 0;
  const refunds = [];

  for await (const refund of refundsIterable) {
    if (!refund) continue;
    if (refund.status && refund.status !== "COMPLETED") continue;

    const raw = refund.amountMoney?.amount ?? 0n;
    const amountCents =
      typeof raw === "bigint" ? Number(raw) : Number(raw || 0);

    totalCents += amountCents;
    count += 1;

    refunds.push({
      id: refund.id,
      paymentId: refund.paymentId,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
      status: refund.status,
      amount: amountCents / 100,
      currency: refund.amountMoney?.currency || "USD",
      reason: refund.reason,
      locationId: refund.locationId,
    });
  }

  return { totalCents, count, refunds };
}

/**
 * Shared helper: aggregate refunds across a time range (UTC ISO strings)
 * across ALL locations, returns:
 *  - grandTotal (sum of refunds, positive dollars)
 *  - grandCount (# of refunds)
 *  - locations[] with { locationId, locationName, count, total, totalFormatted }
 */
async function aggregateRefundsForRange(beginTime, endTime, client) {
  // 1) Get all locations
  const locationsResp = await client.locations.list();
  const locations = locationsResp.locations || [];

  const perLocationResults = await Promise.all(
    locations.map(async (loc) => {
      const agg = await aggregateRefundsForLocation(beginTime, endTime, client, loc.id);
      const total = agg.totalCents / 100;

      return {
        locationId: loc.id,
        locationName: loc.name || loc.id,
        count: agg.count,
        total,
        totalFormatted: total.toLocaleString("en-US", {
          style: "currency",
          currency: agg.refunds[0]?.currency || "USD",
        }),
      };
    })
  );

  const grandTotal = perLocationResults.reduce(
    (sum, loc) => sum + (loc.total || 0),
    0
  );
  const grandCount = perLocationResults.reduce(
    (sum, loc) => sum + (loc.count || 0),
    0
  );

  return {
    grandTotal,
    grandCount,
    locations: perLocationResults,
  };
}
