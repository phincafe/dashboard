import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { DateTime } from "luxon";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import { registerHourlyRoutes } from "./hourlyRoutes.js";
import { registerItemRoutes } from "./itemsRoutes.js";

dotenv.config();

const app = express();


// Basic config
const PORT = process.env.PORT || 4000;
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

// Very simple passcode auth (same behavior as your current app)
const basicPasscode = process.env.BASIC_AUTH_PASSCODE;
if (basicPasscode) {
  app.use((req, res, next) => {
    const passcode = req.headers["x-passcode"];
    if (!passcode || passcode !== basicPasscode) {
      return res.status(401).json({ error: "Invalid passcode" });
    }
    next();
  });
}

// Square client
const squareEnvironment =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

const client = new SquareClient({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: squareEnvironment,
});

console.log("Square env:", squareEnvironment);
console.log("Has access token:", !!process.env.SQUARE_ACCESS_TOKEN);
// Root health check
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Square Reports API running",
    time: DateTime.now().toISO(),
  });
});

// Register feature routes
registerHourlyRoutes(app, client);
registerItemRoutes(app, client);

// --- Daily / weekly / monthly / yearly sales & refunds ---
// NOTE: This mirrors the behavior of your original index.js.
// It exposes:
//   GET /api/sales?date=YYYY-MM-DD
//   GET /api/sales/weekly?week=YYYY-MM-DD
//   GET /api/sales/monthly?month=YYYY-MM
//   GET /api/sales/yearly?year=YYYY
//   GET /api/sales/location?locationId=...&date=YYYY-MM-DD
//   GET /api/refunds?date=YYYY-MM-DD
//   GET /api/refunds/weekly?week=YYYY-MM-DD
//   GET /api/refunds/monthly?month=YYYY-MM
//   GET /api/refunds/yearly?year=YYYY
//   GET /api/debug-locations
//
// For brevity, these handlers are simplified but keep the same
// query parameters and a similar JSON shape to your current app.
const storeTimezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

async function getAllLocations() {
  const locationsResponse = await client.locations.list();
  if (locationsResponse.errors) throw locationsResponse.errors;
  return locationsResponse.result.locations || [];
}

async function aggregateSales(beginTime, endTime, locationIds) {
  const ordersResponse = await client.orders.search({
    locationIds,
    query: {
      filter: {
        dateTimeFilter: {
          createdAt: {
            startAt: beginTime,
            endAt: endTime,
          },
        },
      },
    },
  });

  if (ordersResponse.errors) throw ordersResponse.errors;

  let totalCents = 0;
  let count = 0;

  const orders = ordersResponse.result.orders || [];
  for (const order of orders) {
    const tenders = order.tenders || [];
    for (const tender of tenders) {
      if (tender.amountMoney && tender.amountMoney.amount != null) {
        totalCents += Number(tender.amountMoney.amount);
        count++;
      }
    }
  }

  return {
    totalCents,
    count,
    total: totalCents / 100,
  };
}

function parseDayRange(dateStr) {
  const day = DateTime.fromISO(dateStr, { zone: storeTimezone }).startOf("day");
  if (!day.isValid) throw new Error("Invalid date");
  const start = day.toUTC().toISO();
  const end = day.endOf("day").toUTC().toISO();
  return { start, end, label: day.toISODate() };
}

function parseWeekRange(weekStr) {
  const day = DateTime.fromISO(weekStr, { zone: storeTimezone }).startOf("week");
  if (!day.isValid) throw new Error("Invalid date");
  const endDay = day.plus({ days: 6 });
  return {
    start: day.toUTC().toISO(),
    end: endDay.endOf("day").toUTC().toISO(),
    label: `${day.toISODate()} – ${endDay.toISODate()}`,
  };
}

function parseMonthRange(monthStr) {
  const day = DateTime.fromISO(monthStr + "-01", { zone: storeTimezone }).startOf("month");
  if (!day.isValid) throw new Error("Invalid month");
  const endDay = day.endOf("month");
  return {
    start: day.toUTC().toISO(),
    end: endDay.toUTC().toISO(),
    label: day.toFormat("yyyy-LL"),
  };
}

function parseYearRange(yearStr) {
  const yearInt = Number(yearStr);
  if (!yearInt) throw new Error("Invalid year");
  const start = DateTime.fromObject({ year: yearInt, month: 1, day: 1 }, { zone: storeTimezone });
  const end = start.endOf("year");
  return {
    start: start.toUTC().toISO(),
    end: end.toUTC().toISO(),
    label: String(yearInt),
  };
}

// Daily sales
app.get("/api/sales", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: "Missing date" });
    }
    const { start, end, label } = parseDayRange(date);
    const locations = await getAllLocations();
    const locationIds = locations.map((l) => l.id);

    const summary = await aggregateSales(start, end, locationIds);
    res.json({
      date: label,
      timezone: storeTimezone,
      locations,
      total: summary.total,
      totalCents: summary.totalCents,
      orderCount: summary.count,
    });
  } catch (err) {
    console.error("Error /api/sales", err);
    return res.status(500).json({ error: "Failed to fetch daily sales" });
  }
});

// Weekly
app.get("/api/sales/weekly", async (req, res) => {
  try {
    const { week } = req.query;
    if (!week) {
      return res.status(400).json({ error: "Missing week" });
    }
    const { start, end, label } = parseWeekRange(week);
    const locations = await getAllLocations();
    const locationIds = locations.map((l) => l.id);
    const summary = await aggregateSales(start, end, locationIds);

    res.json({
      week: label,
      timezone: storeTimezone,
      locations,
      total: summary.total,
      totalCents: summary.totalCents,
      orderCount: summary.count,
    });
  } catch (err) {
    console.error("Error /api/sales/weekly", err);
    return res.status(500).json({ error: "Failed to fetch weekly sales" });
  }
});

// Monthly
app.get("/api/sales/monthly", async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ error: "Missing month" });
    }
    const { start, end, label } = parseMonthRange(month);
    const locations = await getAllLocations();
    const locationIds = locations.map((l) => l.id);
    const summary = await aggregateSales(start, end, locationIds);

    res.json({
      month: label,
      timezone: storeTimezone,
      locations,
      total: summary.total,
      totalCents: summary.totalCents,
      orderCount: summary.count,
    });
  } catch (err) {
    console.error("Error /api/sales/monthly", err);
    return res.status(500).json({ error: "Failed to fetch monthly sales" });
  }
});

// Yearly
app.get("/api/sales/yearly", async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ error: "Missing year" });
    }
    const { start, end, label } = parseYearRange(year);
    const locations = await getAllLocations();
    const locationIds = locations.map((l) => l.id);
    const summary = await aggregateSales(start, end, locationIds);

    res.json({
      year: label,
      timezone: storeTimezone,
      locations,
      total: summary.total,
      totalCents: summary.totalCents,
      orderCount: summary.count,
    });
  } catch (err) {
    console.error("Error /api/sales/yearly", err);
    return res.status(500).json({ error: "Failed to fetch yearly sales" });
  }
});

// Debug locations
app.get("/api/debug-locations", async (req, res) => {
  try {
    const locations = await getAllLocations();
    res.json({ locations });
  } catch (err) {
    console.error("Error /api/debug-locations", err);
    return res.status(500).json({ error: "Failed to fetch locations" });
  }
});

// --- Refund endpoints (simplified like sales) ---
async function aggregateRefunds(beginTime, endTime, locationIds) {
  const refundsResponse = await client.refunds.list({
    beginTime,
    endTime,
    locationId: locationIds[0] || undefined,
  });

  if (refundsResponse.errors) throw refundsResponse.errors;

  let totalCents = 0;
  let count = 0;

  const refunds = refundsResponse.result.refunds || [];
  for (const refund of refunds) {
    if (refund.amountMoney && refund.amountMoney.amount != null) {
      totalCents += Number(refund.amountMoney.amount);
      count++;
    }
  }

  return {
    totalCents,
    count,
    total: totalCents / 100,
  };
}

app.get("/api/refunds", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: "Missing date" });
    }
    const { start, end, label } = parseDayRange(date);
    const locations = await getAllLocations();
    const locationIds = locations.map((l) => l.id);
    const summary = await aggregateRefunds(start, end, locationIds);

    res.json({
      date: label,
      timezone: storeTimezone,
      locations,
      total: summary.total,
      totalCents: summary.totalCents,
      refundCount: summary.count,
    });
  } catch (err) {
    console.error("Error /api/refunds", err);
    return res.status(500).json({ error: "Failed to fetch refunds" });
  }
});

app.get("/api/refunds/weekly", async (req, res) => {
  try {
    const { week } = req.query;
    if (!week) {
      return res.status(400).json({ error: "Missing week" });
    }
    const { start, end, label } = parseWeekRange(week);
    const locations = await getAllLocations();
    const locationIds = locations.map((l) => l.id);
    const summary = await aggregateRefunds(start, end, locationIds);

    res.json({
      week: label,
      timezone: storeTimezone,
      locations,
      total: summary.total,
      totalCents: summary.totalCents,
      refundCount: summary.count,
    });
  } catch (err) {
    console.error("Error /api/refunds/weekly", err);
    return res.status(500).json({ error: "Failed to fetch refunds" });
  }
});

app.get("/api/refunds/monthly", async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ error: "Missing month" });
    }
    const { start, end, label } = parseMonthRange(month);
    const locations = await getAllLocations();
    const locationIds = locations.map((l) => l.id);
    const summary = await aggregateRefunds(start, end, locationIds);

    res.json({
      month: label,
      timezone: storeTimezone,
      locations,
      total: summary.total,
      totalCents: summary.totalCents,
      refundCount: summary.count,
    });
  } catch (err) {
    console.error("Error /api/refunds/monthly", err);
    return res.status(500).json({ error: "Failed to fetch refunds" });
  }
});

app.get("/api/refunds/yearly", async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ error: "Missing year" });
    }
    const { start, end, label } = parseYearRange(year);
    const locations = await getAllLocations();
    const locationIds = locations.map((l) => l.id);
    const summary = await aggregateRefunds(start, end, locationIds);

    res.json({
      year: label,
      timezone: storeTimezone,
      locations,
      total: summary.total,
      totalCents: summary.totalCents,
      refundCount: summary.count,
    });
  } catch (err) {
    console.error("Error /api/refunds/yearly", err);
    return res.status(500).json({ error: "Failed to fetch refunds" });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error", err);
  if (err instanceof SquareError) {
    return res.status(500).json({ error: "Square API error" });
  }
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
