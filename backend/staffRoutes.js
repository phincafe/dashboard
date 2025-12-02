// staffRoutes.js
import { DateTime } from "luxon";
import { SquareError } from "square";

export function registerStaffRoutes(app, client) {
  /**
   * GET /api/staff/shifts?date=YYYY-MM-DD
   *
   * Returns:
   * {
   *   date,
   *   timezone,
   *   locations: [{ id, name }],
   *   shifts: [
   *     {
   *       ...rawShift,
   *       team_member_name: "Jane Nguyen"
   *     }
   *   ]
   * }
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

      // --- Locations (for names on UI) ---
      const locationsResp = await client.locations.list();
      const locationsRaw =
        locationsResp.result?.locations || locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));
      const locationIds = locations.map((l) => l.id);

      // --- Build Labor search body (same as your working cURL) ---
      const startUtc = dayStart.toUTC().toISO(); // 00:00 UTC
      const endUtc = dayEnd.toUTC().toISO(); // 23:59:59 UTC

      const body = {
        query: {
          filter: {
            locationIds, // SDK camelCase
            start: {
              startAt: startUtc,
              endAt: endUtc,
            },
            // status: "CLOSED", // you can uncomment if you only want closed shifts
          },
        },
        limit: 200,
      };

      const laborResp = await client.laborApi.searchShifts(body);

      const shiftsRaw =
        laborResp.result?.shifts ||
        laborResp.shifts ||
        [];

      console.log(
        `[staffRoutes] /api/staff/shifts date=${dateStr} rawShifts=${shiftsRaw.length}`
      );

      // --- NEW: pull real names using Team API bulk retrieve ---
      const teamMemberMap = await buildTeamMemberMapFromShifts(
        shiftsRaw,
        client
      );

      const shifts = shiftsRaw.map((shift) => {
        const teamMemberId =
          shift.team_member_id ||
          shift.teamMemberId ||
          shift.employee_id ||
          shift.employeeId;

        const team_member_name =
          (teamMemberId && teamMemberMap[teamMemberId]) || teamMemberId || "Unknown";

        return {
          ...shift,
          team_member_name,
        };
      });

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

/**
 * Build a map of team_member_id -> "First Last" (or nickname)
 * using Square Team API bulk retrieve.
 */
async function buildTeamMemberMapFromShifts(shifts, client) {
  const ids = new Set();

  for (const s of shifts) {
    const id =
      s.team_member_id ||
      s.teamMemberId ||
      s.employee_id ||
      s.employeeId;
    if (id) ids.add(id);
  }

  const teamMemberIds = Array.from(ids);
  if (teamMemberIds.length === 0) {
    console.log("[staffRoutes] No team_member_ids found in shifts.");
    return {};
  }

  try {
    // Node SDK domain for /v2/team-members/* is "teamApi"
    const resp = await client.teamApi.bulkRetrieveTeamMembers({
      teamMemberIds,
    });

    const members =
      resp.result?.teamMembers ||
      resp.teamMembers ||
      [];

    console.log(
      `[staffRoutes] bulkRetrieveTeamMembers returned ${members.length} members`
    );

    const map = {};
    for (const m of members) {
      const id = m.id;

      const given =
        m.givenName ||
        m.given_name ||
        "";
      const family =
        m.familyName ||
        m.family_name ||
        "";
      const nickname = m.nickname || "";

      let displayName = "";

      if (nickname) {
        displayName = nickname;
      } else {
        const full = `${given} ${family}`.trim();
        displayName = full || m.referenceId || id;
      }

      map[id] = displayName;
    }

    return map;
  } catch (err) {
    console.error("Error bulk-retrieving team members:", err);
    // Fall back to empty map – front-end will show IDs instead of names.
    return {};
  }
}
