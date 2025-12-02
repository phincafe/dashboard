// staffRoutes.js
import { DateTime } from "luxon";
import { SquareError } from "square"; // you can keep this for consistency with other routes

export function registerStaffRoutes(app, client) {
  /**
   * GET /api/staff/shifts?date=YYYY-MM-DD
   *
   * Uses the same filter as your working cURL:
   *  - location_ids: all store locations
   *  - start_at: day in UTC (00:00 → 23:59:59)
   * Returns: { date, timezone, locations, shifts }
   */
  app.get("/api/staff/shifts", async (req, res) => {
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";
    const dateStr = req.query.date;

    if (!dateStr) {
      return res.status(400).json({ error: "Missing date=YYYY-MM-DD" });
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    if (!accessToken) {
      return res.status(500).json({
        error: "Missing SQUARE_ACCESS_TOKEN env var",
      });
    }

    try {
      const dayStart = DateTime.fromISO(dateStr, { zone: timezone }).startOf(
        "day"
      );
      const dayEnd = dayStart.endOf("day");

      if (!dayStart.isValid) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      // 1) Get locations so we can show names in the UI
      const locationsResp = await client.locations.list();
      const locationsRaw =
        locationsResp.result?.locations || locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));

      const locationIds = locations.map((l) => l.id);

      // 2) Build the SAME body as your cURL (snake_case!)
      const startUtc = dayStart.toUTC().toISO(); // 2025-11-24T00:00:00Z
      const endUtc = dayEnd.toUTC().toISO();     // 2025-11-24T23:59:59Z

      const body = {
        query: {
          filter: {
            location_ids: locationIds,
            start: {
              start_at: startUtc,
              end_at: endUtc,
            },
            // Optional: filter only CLOSED shifts
            // status: "CLOSED",
          },
        },
        limit: 200,
      };

      // 3) Call the REST API directly with fetch
      const resp = await fetch(
        "https://connect.squareup.com/v2/labor/shifts/search",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "");
        console.error(
          "[staffRoutes] Labor searchShifts HTTP error:",
          resp.status,
          errorText
        );
        return res.status(502).json({
          error: "Square Labor API error",
          status: resp.status,
          body: errorText,
        });
      }

      const json = await resp.json();
      const shifts = json.shifts || [];

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

      // Keep this block if you like, but most errors here are not SquareError anymore
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
