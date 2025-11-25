// hourlyRoutes.js
import { DateTime } from "luxon";
import { SquareError } from "square";

/**
 * Register hourly sales routes on an existing Express app.
 * Call: registerHourlyRoutes(app, client)
 *
 * Endpoints:
 *   - GET /api/sales/hourly?date=YYYY-MM-DD&comparePrev=true
 *   - GET /api/sales/hourly/weekly?week=YYYY-MM-DD&comparePrev=true
 *   - GET /api/sales/hourly/monthly?month=YYYY-MM&comparePrev=true
 *   - GET /api/sales/hourly/yearly?year=YYYY&comparePrev=true
 *
 * All summaries only include hours 5:00–20:59 (5 AM–8 PM).
 */
export function registerHourlyRoutes(app, client) {
  /**
   * DAILY HOURLY: /api/sales/hourly?date=YYYY-MM-DD&comparePrev=true
   */
  app.get("/api/sales/hourly", async (req, res) => {
    const dateStr = req.query.date;
    const comparePrev = req.query.comparePrev === "true";
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!dateStr) {
      return res.status(400).json({ error: "Missing date=YYYY-MM-DD" });
    }

    try {
      const target = DateTime.fromISO(dateStr, { zone: timezone });
      if (!target.isValid) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      // All locations
      const locationsResp = await client.locations.list();
      const locationsRaw = locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));

      // This day
      const baseSummary = await buildHourlySummaryForDate(
        dateStr,
        timezone,
        client,
        locations
      );

      let comparison = null;
      if (comparePrev) {
        const prevDateStr = target.minus({ days: 7 }).toISODate();
        comparison = await buildHourlySummaryForDate(
          prevDateStr,
          timezone,
          client,
          locations
        );
      }

      res.json({
        ...baseSummary, // includes includeDate, timezone, locations, hourly, staffByHour, etc.
        comparison,
      });
    } catch (err) {
      console.error("Error fetching hourly sales (daily):", err);

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

  /**
   * WEEKLY HOURLY: /api/sales/hourly/weekly?week=YYYY-MM-DD&comparePrev=true
   * Aggregates that entire week into an hourly profile.
   */
  app.get("/api/sales/hourly/weekly", async (req, res) => {
    const weekStr = req.query.week;
    const comparePrev = req.query.comparePrev === "true";
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

      const locationsResp = await client.locations.list();
      const locationsRaw = locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));

      const summary = await buildHourlySummaryForRange(
        start,
        end,
        timezone,
        client,
        locations,
        {
          // no includeDate here, so we will NOT attach staffByHour
        }
      );

      let comparison = null;
      if (comparePrev) {
        const prevStart = start.minus({ weeks: 1 });
        const prevEnd = end.minus({ weeks: 1 });

        const prevSummary = await buildHourlySummaryForRange(
          prevStart,
          prevEnd,
          timezone,
          client,
          locations,
          {}
        );

        comparison = {
          ...prevSummary,
          range: {
            start: prevStart.toISODate(),
            end: prevEnd.toISODate(),
          },
        };
      }

      res.json({
        ...summary,
        type: "weekly",
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        comparison,
      });
    } catch (err) {
      console.error("Error fetching hourly sales (weekly):", err);

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

  /**
   * MONTHLY HOURLY: /api/sales/hourly/monthly?month=YYYY-MM&comparePrev=true
   * Aggregates that entire calendar month into an hourly profile.
   */
  app.get("/api/sales/hourly/monthly", async (req, res) => {
    const monthStr = req.query.month; // YYYY-MM
    const comparePrev = req.query.comparePrev === "true";
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

      const locationsResp = await client.locations.list();
      const locationsRaw = locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));

      const summary = await buildHourlySummaryForRange(
        start,
        end,
        timezone,
        client,
        locations,
        {}
      );

      let comparison = null;
      if (comparePrev) {
        const prevStart = start.minus({ months: 1 }).startOf("month");
        const prevEnd = prevStart.endOf("month");

        const prevSummary = await buildHourlySummaryForRange(
          prevStart,
          prevEnd,
          timezone,
          client,
          locations,
          {}
        );

        comparison = {
          ...prevSummary,
          range: {
            start: prevStart.toISODate(),
            end: prevEnd.toISODate(),
          },
        };
      }

      res.json({
        ...summary,
        type: "monthly",
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        comparison,
      });
    } catch (err) {
      console.error("Error fetching hourly sales (monthly):", err);

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

  /**
   * YEARLY HOURLY: /api/sales/hourly/yearly?year=YYYY&comparePrev=true
   * Aggregates that entire calendar year into an hourly profile.
   */
  app.get("/api/sales/hourly/yearly", async (req, res) => {
    const yearStr = req.query.year;
    const comparePrev = req.query.comparePrev === "true";
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!yearStr) {
      return res.status(400).json({ error: "Missing year=YYYY" });
    }

    try {
      const start = DateTime.fromISO(yearStr + "-01-01", {
        zone: timezone,
      }).startOf("year");
      if (!start.isValid) {
        return res.status(400).json({ error: "Invalid year format" });
      }
      const end = start.endOf("year");

      const locationsResp = await client.locations.list();
      const locationsRaw = locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));

      const summary = await buildHourlySummaryForRange(
        start,
        end,
        timezone,
        client,
        locations,
        {}
      );

      let comparison = null;
      if (comparePrev) {
        const prevStart = start.minus({ years: 1 }).startOf("year");
        const prevEnd = prevStart.endOf("year");

        const prevSummary = await buildHourlySummaryForRange(
          prevStart,
          prevEnd,
          timezone,
          client,
          locations,
          {}
        );

        comparison = {
          ...prevSummary,
          range: {
            start: prevStart.toISODate(),
            end: prevEnd.toISODate(),
          },
        };
      }

      res.json({
        ...summary,
        type: "yearly",
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        comparison,
      });
    } catch (err) {
      console.error("Error fetching hourly sales (yearly):", err);

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
}

/**
 * Initialize buckets for hours 5..20 (5 AM–8 PM) for all locations.
 */
function initHourlyBuckets(locations) {
  const hourly = {};
  const locIds = locations.map((l) => l.id);

  for (let h = 5; h <= 20; h++) {
    const totalsByLocation = {};
    const countByLocation = {};

    for (const locId of locIds) {
      totalsByLocation[locId] = 0;
      countByLocation[locId] = 0;
    }

    hourly[h] = {
      totalsByLocation,
      countByLocation,
      totalAllLocations: 0,
      countAllLocations: 0,
    };
  }

  return hourly;
}

/**
 * DAILY summary for a single date string (YYYY-MM-DD).
 */
async function buildHourlySummaryForDate(
  dateStr,
  timezone,
  client,
  locations
) {
  const start = DateTime.fromISO(dateStr, { zone: timezone }).startOf("day");
  const end = start.endOf("day");

  if (!start.isValid) {
    throw new Error("Invalid date for hourly summary");
  }

  return buildHourlySummaryForRange(start, end, timezone, client, locations, {
    includeDate: dateStr,
  });
}

/**
 * Range-based hourly summary (used by weekly & monthly & yearly).
 * start and end are Luxon DateTime objects in store timezone.
 *
 * If extra.includeDate is present, we also attach staffByHour from Labor API
 * for that specific day.
 */
async function buildHourlySummaryForRange(
  start,
  end,
  timezone,
  client,
  locations,
  extra = {}
) {
  const beginTime = start.toUTC().toISO();
  const endTime = end.toUTC().toISO();

  const hourly = initHourlyBuckets(locations);

  let totalAllLocationsCents = 0;
  let totalCountAllLocations = 0;

  // One payments.list per location
  for (const loc of locations) {
    const paymentsIterable = await client.payments.list({
      beginTime,
      endTime,
      sortOrder: "ASC",
      locationId: loc.id,
    });

    for await (const payment of paymentsIterable) {
      if (!payment) continue;
      if (payment.status && payment.status !== "COMPLETED") continue;

      const raw = payment.amountMoney?.amount ?? 0n;
      const amountCents =
        typeof raw === "bigint" ? Number(raw) : Number(raw || 0);

      const createdAt = payment.createdAt;
      if (!createdAt) continue;

      // Convert createdAt → store local time → hour 0..23
      const dtLocal = DateTime.fromISO(createdAt, { zone: "utc" }).setZone(
        timezone
      );
      const hour = dtLocal.hour; // 0..23

      // Only track 5..20
      if (hour < 5 || hour > 20) continue;

      const bucket = hourly[hour];
      if (!bucket) continue;

      bucket.totalsByLocation[loc.id] += amountCents / 100;
      bucket.countByLocation[loc.id] += 1;

      bucket.totalAllLocations += amountCents / 100;
      bucket.countAllLocations += 1;

      totalAllLocationsCents += amountCents;
      totalCountAllLocations += 1;
    }
  }

  // Find max total across hours (for heatmap color scaling)
  let maxHourAllLocations = 0;
  for (let h = 5; h <= 20; h++) {
    const total = hourly[h].totalAllLocations;
    if (total > maxHourAllLocations) {
      maxHourAllLocations = total;
    }
  }

  // Attach staffByHour only for DAILY (when includeDate is present)
  let staffByHour = null;
  if (extra.includeDate) {
    staffByHour = await buildStaffByHourFromLabor({
      dateStr: extra.includeDate,
      timezone,
      locations,
      client,
    });
  }

  return {
    ...extra, // may contain { includeDate }
    timezone,
    locations,
    hourly,
    staffByHour,
    maxHourAllLocations,
    totalAllLocations: totalAllLocationsCents / 100,
    totalCountAllLocations,
  };
}

/**
 * Use Labor API (shifts) to build staffByHour for a single day.
 * staffByHour looks like:
 * {
 *   "5": { "LOCATION_ID": [ { teamMemberId, jobTitle }, ... ], ... },
 *   ...
 *   "20": { ... }
 * }
 */
async function buildStaffByHourFromLabor({
  dateStr,
  timezone,
  locations,
  client,
}) {
  const dayStart = DateTime.fromISO(dateStr, { zone: timezone }).startOf(
    "day"
  );
  const dayEnd = dayStart.endOf("day");

  const staffByHour = {};
  for (let h = 5; h <= 20; h++) {
    staffByHour[h] = {};
    for (const loc of locations) {
      staffByHour[h][loc.id] = [];
    }
  }

  try {
    // Use Square Labor API
    // Make sure your client is configured with the correct access token
    const locationIds = locations.map((l) => l.id);

    const { result } = await client.laborApi.searchShifts({
      query: {
        filter: {
          locationIds,
          start: {
            startAt: dayStart.toISO(),
            endAt: dayEnd.toISO(),
          },
          status: "CLOSED",
        },
      },
    });

    const shifts = result?.shifts || [];

    for (const shift of shifts) {
      const locId = shift.locationId || shift.location_id;
      if (!locId) continue;

      const startStr = shift.startAt || shift.start_at;
      const endStr = shift.endAt || shift.end_at;
      if (!startStr) continue;

      // The timestamp already includes timezone offset (-08:00),
      // so we let Luxon respect that and then convert into store timezone.
      const startLocal = DateTime.fromISO(startStr, { setZone: true }).setZone(
        timezone
      );
      const endLocal = endStr
        ? DateTime.fromISO(endStr, { setZone: true }).setZone(timezone)
        : dayEnd;

      for (let h = 5; h <= 20; h++) {
        const blockStart = dayStart.set({
          hour: h,
          minute: 0,
          second: 0,
          millisecond: 0,
        });
        const blockEnd = blockStart.plus({ hours: 1 });

        // Overlap if shift intersects the hour block
        if (startLocal < blockEnd && endLocal > blockStart) {
          const arr =
            staffByHour[h][locId] || (staffByHour[h][locId] = []);

          const teamMemberId =
            shift.teamMemberId ||
            shift.team_member_id ||
            shift.employeeId ||
            shift.employee_id;

          const jobTitle = shift.wage?.title || "Team Member";

          // Avoid duplicates
          if (
            !arr.some(
              (p) =>
                p.teamMemberId === teamMemberId && p.jobTitle === jobTitle
            )
          ) {
            arr.push({ teamMemberId, jobTitle });
          }
        }
      }
    }
  } catch (err) {
    console.error("Error fetching Labor shifts for staffByHour:", err);
    // If this fails, we just return empty arrays so UI still works.
  }

  return staffByHour;
}
