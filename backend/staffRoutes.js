// staffRoutes.js
import { DateTime } from "luxon";
import { SquareError } from "square";

export function registerStaffRoutes(app, client) {
  /**
   * GET /api/staff/shifts?date=YYYY-MM-DD
   *
   * Very simple: uses Labor API searchShifts and just returns { date, timezone, locations, shifts }
   * Structure of `shifts` is the same as your working cURL response.
   */
  app.get("/api/staff/shifts", async (req, res) => {
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";
    const dateStr = req.query.date;

    if (!dateStr) {
      return res.status(400).json({ error: "Missing date=YYYY-MM-DD" });
    }

    try {
      const dayStart = DateTime.fromISO(dateStr, { zone: timezone }).startOf(
        "day"
      );
      const dayEnd = dayStart.endOf("day");

      if (!dayStart.isValid) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      // Get all locations to know names + ids
      const locationsResp = await client.locations.list();
      const locationsRaw =
        locationsResp.result?.locations || locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));
      const locationIds = locations.map((l) => l.id);

      // Build query equivalent to your cURL:
      // start_at: 2025-11-24T00:00:00Z – 23:59:59Z
      const startUtc = dayStart.toUTC().toISO(); // 00:00 in UTC
      const endUtc = dayEnd.toUTC().toISO(); // 23:59:59 in UTC

      const body = {
        query: {
          filter: {
            locationIds, // SDK camelCase
            start: {
              startAt: startUtc,
              endAt: endUtc,
            },
            // You can also add: status: "CLOSED"
          },
        },
        limit: 200,
      };

      // Call Labor API
      const response = await client.laborApi.searchShifts(body);

      // The SDK returns { result: { shifts: [...] } }
      const shifts =
        response.result?.shifts ||
        response.shifts ||
        [];

      // Helpful logging for debugging:
      console.log(
        `[staffRoutes] /api/staff/shifts date=${dateStr} shifts=${shifts.length}`
      );

      res.json({
        date: dateStr,
        timezone,
        locations,
        shifts,
      });
    } catch (err) {
      console.error("Error fetching staff shifts:", err);

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
