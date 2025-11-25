// laborRoutes.js
import { DateTime } from "luxon";
import { SquareError } from "square";

export function registerLaborRoutes(app, client) {
  /**
   * GET /api/labor/shifts?date=YYYY-MM-DD
   * If date is omitted, defaults to "today" in STORE_TIMEZONE.
   */
  app.get("/api/labor/shifts", async (req, res) => {
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";
    const dateStr =
      req.query.date ||
      DateTime.now().setZone(timezone).toISODate(); // YYYY-MM-DD

    try {
      const dayStart = DateTime.fromISO(dateStr, { zone: timezone }).startOf(
        "day"
      );
      if (!dayStart.isValid) {
        return res.status(400).json({ error: "Invalid date" });
      }
      const dayEnd = dayStart.endOf("day");

      // Get all location IDs (you can also hard-code your 4 if you want)
      const locationsResp = await client.locations.list();
      const locationIds = (locationsResp.locations || []).map((l) => l.id);

      // Call Labor API searchShifts
      const { result } = await client.laborApi.searchShifts({
        body: {
          query: {
            filter: {
              location_ids: locationIds,
              start_at: {
                start_at: dayStart.toISO(), // e.g. 2025-11-24T00:00:00-08:00
                end_at: dayEnd.toISO(),     // same-day end
              },
            },
          },
          limit: 200,
        },
      });

      const rawShifts = result?.shifts || [];

      // Normalize fields a bit for the frontend
      const shifts = rawShifts.map((s) => ({
        id: s.id,
        locationId: s.locationId || s.location_id,
        employeeId: s.employeeId || s.employee_id,
        teamMemberId: s.teamMemberId || s.team_member_id,
        timezone: s.timezone,
        startAt: s.startAt || s.start_at,
        endAt: s.endAt || s.end_at,
        status: s.status,
        wageTitle: s.wage?.title || null,
        hourlyRateCents:
          s.wage?.hourlyRate?.amount ??
          s.wage?.hourly_rate?.amount ??
          null,
        hourlyRateCurrency:
          s.wage?.hourlyRate?.currency ??
          s.wage?.hourly_rate?.currency ??
          null,
      }));

      res.json({
        date: dateStr,
        timezone,
        shifts,
      });
    } catch (err) {
      console.error("Error in /api/labor/shifts:", err);

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
