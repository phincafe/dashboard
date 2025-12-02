// staffRoutes.js
import { DateTime } from "luxon";
import { SquareError } from "square";

export function registerStaffRoutes(app, client) {
  /**
   * GET /api/staff/shifts?date=YYYY-MM-DD
   *
   * Uses raw HTTP calls to Square Labor + Team APIs (like your working cURL),
   * then enriches shifts with a `team_member_name` field.
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
        error: "Missing SQUARE_ACCESS_TOKEN in environment",
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

      // Get all locations (so we can show human names, not just IDs)
      const locationsResp = await client.locations.list();
      const locationsRaw =
        locationsResp.result?.locations || locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));
      const locationIds = locations.map((l) => l.id);

      // Build the same time window as your cURL,
      // but from local day → UTC
      const startUtc = dayStart.toUTC().toISO(); // 00:00 UTC
      const endUtc = dayEnd.toUTC().toISO(); // 23:59:59 UTC

      // ---------- 1) Fetch shifts via raw HTTPS (Labor API) ----------
      const shiftsBody = {
        query: {
          filter: {
            location_ids: locationIds, // snake_case for HTTP JSON
            start: {
              start_at: startUtc,
              end_at: endUtc,
            },
            // If you want only closed shifts, uncomment:
            // status: "CLOSED",
          },
        },
        limit: 200,
      };

      const shiftsResp = await fetch(
        "https://connect.squareup.com/v2/labor/shifts/search",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(shiftsBody),
        }
      );

      if (!shiftsResp.ok) {
        const text = await shiftsResp.text();
        console.error(
          "[staffRoutes] Labor shifts API error:",
          shiftsResp.status,
          text
        );
        return res.status(502).json({
          error: "Square Labor API error",
          details: text,
        });
      }

      const shiftsJson = await shiftsResp.json();
      const shiftsRaw = shiftsJson.shifts || [];

      // ---------- 2) Collect unique team_member_ids ----------
      const teamMemberIdSet = new Set();
      for (const s of shiftsRaw) {
        const tid =
          s.team_member_id ||
          s.teamMemberId ||
          s.employee_id ||
          s.employeeId;
        if (tid) teamMemberIdSet.add(tid);
      }
      const teamMemberIds = Array.from(teamMemberIdSet);

      // ---------- 3) Fetch team member names ----------
      let teamMembersMap = {};
      if (teamMemberIds.length > 0) {
        const tmBody = {
          team_member_ids: teamMemberIds, // snake_case for HTTP JSON
        };

        const tmResp = await fetch(
          "https://connect.squareup.com/v2/team-members/bulk-retrieve",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(tmBody),
          }
        );

        if (!tmResp.ok) {
          const text = await tmResp.text();
          console.error(
            "[staffRoutes] Team members bulk-retrieve error:",
            tmResp.status,
            text
          );
        } else {
          const tmJson = await tmResp.json();
          // Response format is typically: { team_members: [ { id, given_name, family_name, ... }, ... ] }
          const tmList = tmJson.team_members || tmJson.teamMembers || [];
          teamMembersMap = tmList.reduce((acc, tm) => {
            const id = tm.id;
            if (!id) return acc;

            const first =
              tm.given_name ||
              tm.givenName ||
              tm.first_name ||
              tm.firstName ||
              "";
            const last =
              tm.family_name ||
              tm.familyName ||
              tm.last_name ||
              tm.lastName ||
              "";
            const display =
              (first + " " + last).trim() ||
              tm.display_name ||
              tm.displayName ||
              tm.reference_id ||
              id;

            acc[id] = display;
            return acc;
          }, {});
        }
      }

      // ---------- 4) Attach `team_member_name` to each shift ----------
      const shifts = shiftsRaw.map((s) => {
        const teamId =
          s.team_member_id ||
          s.teamMemberId ||
          s.employee_id ||
          s.employeeId;
        const teamName = teamId ? teamMembersMap[teamId] || teamId : null;

        return {
          ...s,
          team_member_name: teamName,
        };
      });

      console.log(
        `[staffRoutes] /api/staff/shifts date=${dateStr} shifts=${shifts.length}`
      );

      // ---------- 5) Return payload ----------
      res.json({
        date: dateStr,
        timezone,
        locations,
        shifts,
      });
    } catch (err) {
      console.error("Error fetching staff shifts:", err);

      // We still keep SquareError check in case locations.list throws a typed error
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
