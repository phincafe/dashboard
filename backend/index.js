import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { DateTime } from "luxon";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import { registerHourlyRoutes } from "./hourlyRoutes.js";
import { registerItemRoutes } from "./itemsRoutes.js";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import dotenv from "dotenv";

dotenv.config();

const rawEnv = (process.env.SQUARE_ENVIRONMENT || "sandbox").toLowerCase();
const envEnum =
  rawEnv === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

const sqToken = process.env.SQUARE_ACCESS_TOKEN || "";

console.log("=== SQUARE CONFIG ===");
console.log("SQUARE_ENVIRONMENT =", rawEnv);
console.log(
  "Using SquareEnvironment:",
  envEnum === SquareEnvironment.Production ? "PRODUCTION" : "SANDBOX"
);
console.log(
  "SQUARE_ACCESS_TOKEN present?",
  sqToken ? "YES, length=" + sqToken.length : "NO"
);
console.log(
  "SQUARE_ACCESS_TOKEN prefix:",
  sqToken ? sqToken.slice(0, 8) + "..." : "MISSING"
);
console.log("=====================");

if (!sqToken) {
  throw new Error("Missing SQUARE_ACCESS_TOKEN env var");
}

const client = new SquareClient({
  token: sqToken,
  environment: envEnum,
});




// --- Express app ---
const app = express();

// CORS – lock to your frontend origin
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

// Optional passcode via header x-passcode
// Set BASIC_AUTH_PASSCODE in Render if you want protection.
const basicPasscode = process.env.BASIC_AUTH_PASSCODE;
if (basicPasscode) {
  app.use((req, res, next) => {
    const pass = req.headers["x-passcode"];
    if (!pass || pass !== basicPasscode) {
      return res.status(401).json({ error: "Invalid passcode" });
    }
    next();
  });
}

// Register hourly + item routes (same as old)
registerHourlyRoutes(app, client);
registerItemRoutes(app, client);

const STORE_TZ = process.env.STORE_TIMEZONE || "America/Los_Angeles";

// --- Helpers: PAYMENTS / REFUNDS ---

/**
 * Detailed payments for ONE location (used for DAILY).
 */
async function aggregateForLocation(beginTime, endTime, locationId) {
  const paymentsIterable = await client.payments.list({
    beginTime,
    endTime,
    sortOrder: "ASC",
    locationId,
  });

  let totalCents = 0;
  let count = 0;
  const payments = [];

  for await (const payment of paymentsIterable) {
    if (!payment) continue;
    if (payment.status && payment.status !== "COMPLETED") continue;

    const raw = payment.amountMoney?.amount ?? 0n;
    const amountCents =
      typeof raw === "bigint" ? Number(raw) : Number(raw || 0);

    totalCents += amountCents;
    count += 1;

    payments.push({
      id: payment.id,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      note: payment.note,
      status: payment.status,
      amount: amountCents / 100,
      currency: payment.amountMoney?.currency || "USD",
      buyerEmail: payment.buyerEmailAddress,
      orderId: payment.orderId,
      receiptUrl: payment.receiptUrl,
      deviceDetails: payment.deviceDetails,
      locationId: payment.locationId,
    });
  }

  return { totalCents, count, payments };
}

/**
 * Summary (no payments array) for ONE location.
 * Used for weekly / monthly / yearly sales.
 */
async function aggregateForLocationSummary(beginTime, endTime, locationId) {
  const paymentsIterable = await client.payments.list({
    beginTime,
    endTime,
    sortOrder: "ASC",
    locationId,
  });

  let totalCents = 0;
  let count = 0;

  for await (const payment of paymentsIterable) {
    if (!payment) continue;
    if (payment.status !== "COMPLETED") continue;

    const raw = payment.amountMoney?.amount ?? 0n;
    const amountCents =
      typeof raw === "bigint" ? Number(raw) : Number(raw || 0);

    totalCents += amountCents;
    count++;
  }

  return {
    totalCents,
    count,
  };
}

/**
 * Refund aggregation for a single location.
 */
async function aggregateRefundsForLocation(beginTime, endTime, locationId) {
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

// --- REFUNDS ROUTES (same as old backend) ---

// DAILY REFUNDS: /api/refunds?date=YYYY-MM-DD
app.get("/api/refunds", async (req, res) => {
  const dateStr = req.query.date;
  const timezone = STORE_TZ;

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

    const locationsResponse = await client.locations.list();
    const locations = locationsResponse.locations || [];

    const perLocationResults = await Promise.all(
      locations.map(async (loc) => {
        const agg = await aggregateRefundsForLocation(
          beginTime,
          endTime,
          loc.id
        );
        const total = agg.totalCents / 100;

        return {
          locationId: loc.id,
          locationName: loc.name || loc.id,
          total,
          totalFormatted: total.toLocaleString("en-US", {
            style: "currency",
            currency: agg.refunds[0]?.currency || "USD",
          }),
          count: agg.count,
          refunds: agg.refunds,
        };
      })
    );

    const grandRefundTotal = perLocationResults.reduce(
      (sum, loc) => sum + (loc.total || 0),
      0
    );
    const grandRefundCount = perLocationResults.reduce(
      (sum, loc) => sum + (loc.count || 0),
      0
    );

    res.json({
      date: dateStr,
      timezone,
      grandRefundTotal,
      grandRefundTotalFormatted: grandRefundTotal.toLocaleString("en-US", {
        style: "currency",
        currency: perLocationResults[0]?.refunds[0]?.currency || "USD",
      }),
      grandRefundCount,
      locationsCount: perLocationResults.length,
      locations: perLocationResults,
    });
  } catch (err) {
    console.error("Error fetching refunds:", err);

    if (err instanceof SquareError) {
      return res.status(502).json({
        error: "Square API error",
        details: err.body,
      });
    }

    res.status(500).json({
      error: "Unexpected server error",
    });
  }
});

// WEEKLY REFUNDS: /api/refunds/weekly?week=YYYY-MM-DD
app.get("/api/refunds/weekly", async (req, res) => {
  const dateStr = req.query.week;
  const timezone = STORE_TZ;

  if (!dateStr) {
    return res.status(400).json({ error: "Missing week=YYYY-MM-DD" });
  }

  try {
    const target = DateTime.fromISO(dateStr, { zone: timezone });
    if (!target.isValid) {
      return res.status(400).json({ error: "Invalid week date" });
    }

    const start = target.startOf("week");
    const end = target.endOf("week");

    const beginTime = start.toUTC().toISO();
    const endTime = end.toUTC().toISO();

    const locationsResponse = await client.locations.list();
    const locations = locationsResponse.locations || [];

    const perLocationResults = await Promise.all(
      locations.map(async (loc) => {
        const agg = await aggregateRefundsForLocation(
          beginTime,
          endTime,
          loc.id
        );
        const total = agg.totalCents / 100;

        return {
          locationId: loc.id,
          locationName: loc.name || loc.id,
          total,
          totalFormatted: total.toLocaleString("en-US", {
            style: "currency",
            currency: agg.refunds[0]?.currency || "USD",
          }),
          count: agg.count,
          refunds: agg.refunds,
        };
      })
    );

    const grandRefundTotal = perLocationResults.reduce(
      (sum, loc) => sum + (loc.total || 0),
      0
    );
    const grandRefundCount = perLocationResults.reduce(
      (sum, loc) => sum + (loc.count || 0),
      0
    );

    res.json({
      range: { start: start.toISODate(), end: end.toISODate() },
      type: "weekly",
      grandRefundTotal,
      grandRefundTotalFormatted: grandRefundTotal.toLocaleString("en-US", {
        style: "currency",
        currency: perLocationResults[0]?.refunds[0]?.currency || "USD",
      }),
      grandRefundCount,
      locationsCount: perLocationResults.length,
      locations: perLocationResults,
    });
  } catch (err) {
    console.error("Error fetching weekly refunds:", err);

    if (err instanceof SquareError) {
      return res.status(502).json({
        error: "Square API error",
        details: err.body,
      });
    }

    res.status(500).json({
      error: "Unexpected server error",
    });
  }
});

// MONTHLY REFUNDS: /api/refunds/monthly?month=YYYY-MM
app.get("/api/refunds/monthly", async (req, res) => {
  const monthStr = req.query.month;
  const timezone = STORE_TZ;

  if (!monthStr) {
    return res.status(400).json({ error: "Missing month=YYYY-MM" });
  }

  try {
    const start = DateTime.fromISO(monthStr + "-01", {
      zone: timezone,
    }).startOf("month");
    const end = start.endOf("month");

    const beginTime = start.toUTC().toISO();
    const endTime = end.toUTC().toISO();

    const locationsResponse = await client.locations.list();
    const locations = locationsResponse.locations || [];

    const perLocationResults = await Promise.all(
      locations.map(async (loc) => {
        const agg = await aggregateRefundsForLocation(
          beginTime,
          endTime,
          loc.id
        );
        const total = agg.totalCents / 100;

        return {
          locationId: loc.id,
          locationName: loc.name || loc.id,
          total,
          totalFormatted: total.toLocaleString("en-US", {
            style: "currency",
            currency: agg.refunds[0]?.currency || "USD",
          }),
          count: agg.count,
          refunds: agg.refunds,
        };
      })
    );

    const grandRefundTotal = perLocationResults.reduce(
      (sum, loc) => sum + (loc.total || 0),
      0
    );
    const grandRefundCount = perLocationResults.reduce(
      (sum, loc) => sum + (loc.count || 0),
      0
    );

    res.json({
      range: { start: start.toISODate(), end: end.toISODate() },
      type: "monthly",
      grandRefundTotal,
      grandRefundTotalFormatted: grandRefundTotal.toLocaleString("en-US", {
        style: "currency",
        currency: perLocationResults[0]?.refunds[0]?.currency || "USD",
      }),
      grandRefundCount,
      locationsCount: perLocationResults.length,
      locations: perLocationResults,
    });
  } catch (err) {
    console.error("Error fetching monthly refunds:", err);

    if (err instanceof SquareError) {
      return res.status(502).json({
        error: "Square API error",
        details: err.body,
      });
    }

    res.status(500).json({
      error: "Unexpected server error",
    });
  }
});

// YEARLY REFUNDS: /api/refunds/yearly?year=YYYY
app.get("/api/refunds/yearly", async (req, res) => {
  const yearStr = req.query.year;
  const timezone = STORE_TZ;

  if (!yearStr) {
    return res.status(400).json({ error: "Missing year=YYYY" });
  }

  try {
    const start = DateTime.fromISO(yearStr + "-01-01", {
      zone: timezone,
    }).startOf("year");
    const end = start.endOf("year");

    const beginTime = start.toUTC().toISO();
    const endTime = end.toUTC().toISO();

    const locationsResponse = await client.locations.list();
    const locations = locationsResponse.locations || [];

    const perLocationResults = await Promise.all(
      locations.map(async (loc) => {
        const agg = await aggregateRefundsForLocation(
          beginTime,
          endTime,
          loc.id
        );
        const total = agg.totalCents / 100;

        return {
          locationId: loc.id,
          locationName: loc.name || loc.id,
          total,
          totalFormatted: total.toLocaleString("en-US", {
            style: "currency",
            currency: agg.refunds[0]?.currency || "USD",
          }),
          count: agg.count,
          refunds: agg.refunds,
        };
      })
    );

    const grandRefundTotal = perLocationResults.reduce(
      (sum, loc) => sum + (loc.total || 0),
      0
    );
    const grandRefundCount = perLocationResults.reduce(
      (sum, loc) => sum + (loc.count || 0),
      0
    );

    res.json({
      range: { start: start.toISODate(), end: end.toISODate() },
      type: "yearly",
      grandRefundTotal,
      grandRefundTotalFormatted: grandRefundTotal.toLocaleString("en-US", {
        style: "currency",
        currency: perLocationResults[0]?.refunds[0]?.currency || "USD",
      }),
      grandRefundCount,
      locationsCount: perLocationResults.length,
      locations: perLocationResults,
    });
  } catch (err) {
    console.error("Error fetching yearly refunds:", err);

    if (err instanceof SquareError) {
      return res.status(502).json({
        error: "Square API error",
        details: err.body,
      });
    }

    res.status(500).json({
      error: "Unexpected server error",
    });
  }
});

// Single-location daily sales debug
app.get("/api/sales/location", async (req, res) => {
  const locationId = req.query.locationId;
  const dateStr = req.query.date;
  const timezone = STORE_TZ;

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
      return res.status(400).json({ error: "Invalid date format" });
    }

    const beginTime = start.toUTC().toISO();
    const endTime = end.toUTC().toISO();

    const agg = await aggregateForLocation(beginTime, endTime, locationId);
    const total = agg.totalCents / 100;

    return res.json({
      locationId,
      date: dateStr,
      total,
      totalFormatted: total.toLocaleString("en-US", {
        style: "currency",
        currency: agg.payments[0]?.currency || "USD",
      }),
      count: agg.count,
      payments: agg.payments,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Square API error",
      details: err.message,
    });
  }
});

// Debug locations
app.get("/api/debug-locations", async (req, res) => {
  try {
    const now = DateTime.now().setZone(STORE_TZ);
    const start = now.minus({ days: 30 }).startOf("day");
    const end = now.endOf("day");

    const beginTime = start.toUTC().toISO();
    const endTime = end.toUTC().toISO();

    const locResp = await client.locations.list();
    const locations = locResp.locations || [];

    const counts = {};
    const paymentsIterable = await client.payments.list({ beginTime, endTime });

    for await (const p of paymentsIterable) {
      if (!p) continue;
      const id = p.locationId || "UNKNOWN";
      counts[id] = (counts[id] || 0) + 1;
    }

    res.json({ locations, counts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "debug failed" });
  }
});

// DAILY SALES: /api/sales?date=YYYY-MM-DD
app.get("/api/sales", async (req, res) => {
  const dateStr = req.query.date;
  const timezone = STORE_TZ;

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

    const locationsResponse = await client.locations.list();
    const locations = locationsResponse.locations || [];

    const perLocationResults = await Promise.all(
      locations.map(async (loc) => {
        const agg = await aggregateForLocation(beginTime, endTime, loc.id);
        const total = agg.totalCents / 100;

        return {
          locationId: loc.id,
          locationName: loc.name || loc.id,
          total,
          totalFormatted: total.toLocaleString("en-US", {
            style: "currency",
            currency: agg.payments[0]?.currency || "USD",
          }),
          count: agg.count,
          payments: agg.payments,
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

    res.json({
      date: dateStr,
      timezone,
      grandTotal,
      grandTotalFormatted: grandTotal.toLocaleString("en-US", {
        style: "currency",
        currency: perLocationResults[0]?.payments[0]?.currency || "USD",
      }),
      grandCount,
      locationsCount: perLocationResults.length,
      locations: perLocationResults,
    });
  } catch (err) {
    console.error("Error fetching sales:", err);

    if (err instanceof SquareError) {
      return res.status(502).json({
        error: "Square API error",
        details: err.body,
      });
    }

    res.status(500).json({
      error: "Unexpected server error",
    });
  }
});

// WEEKLY SALES SUMMARY
app.get("/api/sales/weekly", async (req, res) => {
  const dateStr = req.query.week;
  const timezone = STORE_TZ;

  if (!dateStr) {
    return res.status(400).json({ error: "Missing week=YYYY-MM-DD" });
  }

  try {
    const target = DateTime.fromISO(dateStr, { zone: timezone });
    if (!target.isValid) {
      return res.status(400).json({ error: "Invalid week date" });
    }

    const start = target.startOf("week");
    const end = target.endOf("week");

    const beginTime = start.toUTC().toISO();
    const endTime = end.toUTC().toISO();

    const locationsResponse = await client.locations.list();
    const locations = locationsResponse.locations || [];

    const perLocationResults = await Promise.all(
      locations.map(async (loc) => {
        const agg = await aggregateForLocationSummary(beginTime, endTime, loc.id);
        const total = agg.totalCents / 100;

        return {
          locationId: loc.id,
          locationName: loc.name || loc.id,
          total,
          totalFormatted: total.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          }),
          count: agg.count,
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

    res.json({
      range: { start: start.toISODate(), end: end.toISODate() },
      type: "weekly",
      grandTotal,
      grandTotalFormatted: grandTotal.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      }),
      grandCount,
      locations: perLocationResults,
    });
  } catch (err) {
    console.error("Weekly report failed:", err);
    res
      .status(500)
      .json({ error: "Weekly report failed", details: err.message });
  }
});

// MONTHLY SALES SUMMARY
app.get("/api/sales/monthly", async (req, res) => {
  const monthStr = req.query.month;
  const timezone = STORE_TZ;

  if (!monthStr) {
    return res.status(400).json({ error: "Missing month=YYYY-MM" });
  }

  try {
    const start = DateTime.fromISO(monthStr + "-01", {
      zone: timezone,
    }).startOf("month");
    const end = start.endOf("month");

    const beginTime = start.toUTC().toISO();
    const endTime = end.toUTC().toISO();

    const locationsResponse = await client.locations.list();
    const locations = locationsResponse.locations || [];

    const perLocationResults = await Promise.all(
      locations.map(async (loc) => {
        const agg = await aggregateForLocationSummary(beginTime, endTime, loc.id);
        const total = agg.totalCents / 100;

        return {
          locationId: loc.id,
          locationName: loc.name || loc.id,
          total,
          totalFormatted: total.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          }),
          count: agg.count,
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

    res.json({
      range: { start: start.toISODate(), end: end.toISODate() },
      type: "monthly",
      grandTotal,
      grandTotalFormatted: grandTotal.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      }),
      grandCount,
      locations: perLocationResults,
    });
  } catch (err) {
    console.error("Monthly report failed:", err);
    res
      .status(500)
      .json({ error: "Monthly report failed", details: err.message });
  }
});

// YEARLY SALES SUMMARY
app.get("/api/sales/yearly", async (req, res) => {
  const yearStr = req.query.year;
  const timezone = STORE_TZ;

  if (!yearStr) {
    return res.status(400).json({ error: "Missing year=YYYY" });
  }

  try {
    const start = DateTime.fromISO(yearStr + "-01-01", {
      zone: timezone,
    }).startOf("year");
    const end = start.endOf("year");

    const beginTime = start.toUTC().toISO();
    const endTime = end.toUTC().toISO();

    const locationsResponse = await client.locations.list();
    const locations = locationsResponse.locations || [];

    const perLocationResults = await Promise.all(
      locations.map(async (loc) => {
        const agg = await aggregateForLocationSummary(beginTime, endTime, loc.id);
        const total = agg.totalCents / 100;

        return {
          locationId: loc.id,
          locationName: loc.name || loc.id,
          total,
          totalFormatted: total.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          }),
          count: agg.count,
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

    res.json({
      range: { start: start.toISODate(), end: end.toISODate() },
      type: "yearly",
      grandTotal,
      grandTotalFormatted: grandTotal.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      }),
      grandCount,
      locations: perLocationResults,
    });
  } catch (err) {
    console.error("Yearly report failed:", err);
    res
      .status(500)
      .json({ error: "Yearly report failed", details: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Square Reports backend running" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error", err);
  if (err instanceof SquareError) {
    return res.status(500).json({ error: "Square API error" });
  }
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
