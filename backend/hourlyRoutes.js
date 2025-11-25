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
        locations
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
          locations
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
        locations
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
          locations
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
        locations
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
          locations
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
 * Initialize staffByHour with hours 5..20 and all locations.
 * staffByHour[hour][locationId] = []
 */
function initStaffByHour(locations) {
  const staffByHour = {};
  const locIds = locations.map((l) => l.id);

  for (let h = 5; h <= 20; h++) {
    staffByHour[h] = {};
    for (const locId of locIds) {
      staffByHour[h][locId] = [];
    }
  }

  return staffByHour;
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
  const staffByHour = initStaffByHourBuckets(locations);

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

      const dtLocal = DateTime.fromISO(createdAt, { zone: "utc" }).setZone(
        timezone
      );
      const hour = dtLocal.hour; // 0..23

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

  // 🔹 Attach staff info via Labor Shifts
  await attachStaffWithLaborShifts(start, end, timezone, locations, staffByHour);

  // Find max total across hours (for heatmap color scaling)
  let maxHourAllLocations = 0;
  for (let h = 5; h <= 20; h++) {
    const total = hourly[h].totalAllLocations;
    if (total > maxHourAllLocations) {
      maxHourAllLocations = total;
    }
  }

  return {
    ...extra, // may contain includeDate or range
    timezone,
    locations,
    hourly,
    staffByHour, // 🔹 now returned to frontend
    maxHourAllLocations,
    totalAllLocations: totalAllLocationsCents / 100,
    totalCountAllLocations,
  };
}

/**
 * Initialize staffByHour buckets: hours 5..20, each hour has per-location arrays.
 */
function initStaffByHourBuckets(locations) {
  const staffByHour = {};
  const locIds = locations.map((l) => l.id);

  for (let h = 5; h <= 20; h++) {
    const perLoc = {};
    for (const locId of locIds) {
      perLoc[locId] = [];
    }
    staffByHour[h] = perLoc;
  }
  return staffByHour;
}

/**
 * Try to attach staff-on-shift using Labor Shifts API.
 * Does NOT throw; logs errors and leaves staffByHour empty on failure.
 *
 * - start / end are Luxon DateTime in store timezone
 * - staffByHour is: { [hour]: { [locationId]: [] } }
 */
async function attachStaffWithLaborShifts(start, end, timezone, locations, staffByHour) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn("No SQUARE_ACCESS_TOKEN set; cannot fetch Labor shifts.");
    return;
  }

  const env = (process.env.SQUARE_ENV || "sandbox").toLowerCase();
  const baseUrl =
    env === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";

  const locationIds = locations.map((l) => l.id);

  // Use the same UTC range as payments
  const beginTime = start.toUTC().toISO();
  const endTime = end.toUTC().toISO();

  let cursor = null;

  try {
    do {
      const body = {
        query: {
          filter: {
            location_ids: locationIds,
            start: {
              start_at: beginTime,
              end_at: endTime,
            },
          },
        },
        limit: 200,
        cursor: cursor || undefined,
      };

      const resp = await fetch(`${baseUrl}/v2/labor/shifts/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error("Labor Shifts API error:", resp.status, text);
        return; // don’t break hourly sales, just skip staff
      }

      const json = await resp.json();
      const shifts = json.shifts || [];
      cursor = json.cursor || null;

      for (const shift of shifts) {
        const locId = shift.location_id || "UNKNOWN";
        if (!staffByHour[5] || staffByHour[5][locId] === undefined) {
          // location not in our list / outside our stores
          continue;
        }

        const teamMemberId = shift.team_member_id || "unknown";
        const startAt = shift.start_at;
        const endAtRaw = shift.end_at;

        if (!startAt) continue;

        const startLocal = DateTime.fromISO(startAt, { zone: "utc" }).setZone(
          timezone
        );
        const endLocal = endAtRaw
          ? DateTime.fromISO(endAtRaw, { zone: "utc" }).setZone(timezone)
          : end; // still on shift → clamp to our end

        // For each hour 5..20, see if shift overlaps that hour block
        for (let h = 5; h <= 20; h++) {
          const blockStart = startLocal.startOf("day").set({ hour: h });
          const blockEnd = blockStart.plus({ hours: 1 });

          // overlap if shiftStart < blockEnd && shiftEnd > blockStart
          if (startLocal < blockEnd && endLocal > blockStart) {
            const list = staffByHour[h][locId];
            // avoid duplicates if a shift somehow overlaps multiple times
            if (!list.find((s) => s.teamMemberId === teamMemberId)) {
              list.push({
                teamMemberId,
                // These two are nice to have if you later show details:
                startLocal: startLocal.toISO(),
                endLocal: endLocal.toISO(),
              });
            }
          }
        }
      }
    } while (cursor);
  } catch (err) {
    console.error("attachStaffWithLaborShifts failed:", err);
  }
}


/**
 * Build staff on-shift per hour using Square Timecards (Labor API).
 *
 * staffByHour[hour][locationId] = [ "EmployeeId1", "EmployeeId2", ... ]
 *
 * - We treat a timecard as "on shift" for all whole hours that overlap the
 *   [clockIn, clockOut) interval in store local time.
 * - If clockOutTime is missing (still on shift), we treat end as the end of
 *   the requested range.
 */
async function buildStaffByHourForRange(
  start,
  end,
  timezone,
  client,
  locations,
  staffByHourBase
) {
  const staffByHour = { ...staffByHourBase };
  const locIds = new Set(locations.map((l) => l.id));

  const beginClockInTime = start.toUTC().toISO();
  const endClockInTime = end.toUTC().toISO();

  let cursor = undefined;

  try {
    // We use Labor/Timecards: listTimecards with a cursor loop
    do {
      // NOTE: If your SDK groups timecards differently, adjust this call.
      const resp = await client.labor.listTimecards({
        beginClockInTime,
        endClockInTime,
        cursor,
        limit: 200,
      });

      const timecards = resp.timecards || [];
      cursor = resp.cursor;

      for (const tc of timecards) {
        if (!tc) continue;

        const locationId = tc.locationId || "UNKNOWN";
        if (!locIds.has(locationId)) {
          // Skip timecards for locations not in this report
          continue;
        }

        const clockInTime = tc.clockInTime;
        if (!clockInTime) continue;

        const clockInLocal = DateTime.fromISO(clockInTime, {
          zone: "utc",
        }).setZone(timezone);

        let clockOutLocal;
        if (tc.clockOutTime) {
          clockOutLocal = DateTime.fromISO(tc.clockOutTime, {
            zone: "utc",
          }).setZone(timezone);
        } else {
          // Still on shift; clamp to end of the reporting range
          clockOutLocal = end.setZone(timezone);
        }

        if (!clockInLocal.isValid || !clockOutLocal.isValid) continue;
        if (clockOutLocal <= clockInLocal) continue; // 0-length or invalid

        // Clamp to reporting day range in local time
        const rangeStartLocal = start.setZone(timezone);
        const rangeEndLocal = end.setZone(timezone);

        let shiftStart = clockInLocal < rangeStartLocal ? rangeStartLocal : clockInLocal;
        let shiftEnd = clockOutLocal > rangeEndLocal ? rangeEndLocal : clockOutLocal;

        if (shiftEnd <= shiftStart) continue;

        // Determine which integer hours [h, h+1) overlap this shift
        let startHour = shiftStart.hour;
        let endHour = shiftEnd.hour;

        // If they clock out exactly at e.g. 13:00, we don't include 13
        if (shiftEnd.minute === 0 && shiftEnd.second === 0 && shiftEnd.millisecond === 0) {
          endHour = endHour - 1;
        }

        startHour = Math.max(5, startHour);
        endHour = Math.min(20, endHour);

        if (endHour < 5 || startHour > 20) continue;

        const staffId = tc.employeeId || tc.teamMemberId || "Unknown staff";

        for (let h = startHour; h <= endHour; h++) {
          if (!staffByHour[h]) continue;
          if (!staffByHour[h][locationId]) {
            staffByHour[h][locationId] = [];
          }

          // avoid duplicates if we somehow process overlapping timecards
          if (!staffByHour[h][locationId].includes(staffId)) {
            staffByHour[h][locationId].push(staffId);
          }
        }
      }
    } while (cursor);
  } catch (err) {
    console.error("Error fetching timecards for staffByHour:", err);
    // If this fails, we just return the empty staffByHour structure
    return staffByHourBase;
  }

  return staffByHour;
}
