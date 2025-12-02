// staffRoutes.js
import { DateTime } from "luxon";
import { SquareError } from "square";

/**
 * Build a map of team_member_id -> team member object
 * We try both searchTeamMembers and listTeamMembers, and both camelCase/snake_case fields.
 */
async function fetchTeamMemberMap(client) {
  const map = {};

  try {
    let teamMembers = [];

    // Try searchTeamMembers first
    if (client.team && typeof client.team.searchTeamMembers === "function") {
      const resp = await client.team.searchTeamMembers({
        query: {
          filter: {
            status: "ACTIVE",
          },
        },
      });

      teamMembers =
        resp.result?.teamMembers ||
        resp.teamMembers ||
        resp.result?.team_members ||
        resp.team_members ||
        [];
    }
    // Fallback: listTeamMembers
    else if (client.team && typeof client.team.listTeamMembers === "function") {
      const resp = await client.team.listTeamMembers({});
      teamMembers =
        resp.result?.teamMembers ||
        resp.teamMembers ||
        resp.result?.team_members ||
        resp.team_members ||
        [];
    } else {
      console.warn(
        "[staffRoutes] client.team has no searchTeamMembers/listTeamMembers; cannot map names."
      );
      return map;
    }

    for (const m of teamMembers) {
      if (!m) continue;

      // ID can be id or teamMemberId depending on SDK shape
      const id = m.id || m.teamMemberId || m.team_member_id;
      if (!id) continue;

      map[id] = m;
    }

    console.log(
      `[staffRoutes] fetchTeamMemberMap: loaded ${Object.keys(map).length} team members`
    );
  } catch (err) {
    console.error("[staffRoutes] Error fetching team members:", err);
  }

  return map;
}

/**
 * Helper to compute a nice display name from a teamMember object + fallback ID
 */
function getTeamMemberDisplayName(member, fallbackId) {
  if (!member) return fallbackId || "Unknown";

  const given =
    member.given_name || member.givenName || member.first_name || member.firstName;
  const family =
    member.family_name || member.familyName || member.last_name || member.lastName;
  const reference = member.reference_id || member.referenceId;
  const nickname = member.nickname || member.nick_name;
  const email = member.email_address || member.emailAddress;

  const full = [given, family].filter(Boolean).join(" ").trim();

  return (
    full ||
    nickname ||
    reference ||
    email ||
    fallbackId ||
    "Unknown"
  );
}

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
   *       ...shiftFromLabor,
   *       team_member_id: "...",
   *       team_member_name: "Full Name"
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

      // Locations for nice names
      const locationsResp = await client.locations.list();
      const locationsRaw =
        locationsResp.result?.locations || locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));
      const locationIds = locations.map((l) => l.id);

      // Time window (UTC) for this day – same as your curl
      const startUtc = dayStart.toUTC().toISO();
      const endUtc = dayEnd.toUTC().toISO();

      const body = {
        query: {
          filter: {
            locationIds, // camelCase for SDK
            start: {
              startAt: startUtc,
              endAt: endUtc,
            },
            status: "CLOSED",
          },
        },
        limit: 200,
      };

      // Labor API (we already know client.labor.searchShifts works)
      const response = await client.labor.searchShifts(body);

      const rawShifts =
        response.result?.shifts ||
        response.shifts ||
        [];

      console.log(
        `[staffRoutes] /api/staff/shifts date=${dateStr} rawShifts=${rawShifts.length}`
      );

      // Load team member map (id => member object)
      const teamMemberMap = await fetchTeamMemberMap(client);

      // Annotate shifts with team_member_id and team_member_name
      const shifts = rawShifts.map((shift) => {
        const tmId =
          shift.team_member_id ||
          shift.teamMemberId ||
          shift.employee_id ||
          shift.employeeId;

        const member = tmId ? teamMemberMap[tmId] : undefined;
        const displayName = getTeamMemberDisplayName(member, tmId);

        return {
          ...shift,
          team_member_id: tmId || null,
          team_member_name: displayName,
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

  /**
   * Optional debug endpoint so you can see what team members look like
   * GET /api/staff/team-members
   */
  app.get("/api/staff/team-members", async (req, res) => {
    try {
      const teamMemberMap = await fetchTeamMemberMap(client);
      res.json({
        count: Object.keys(teamMemberMap).length,
        teamMembers: Object.values(teamMemberMap),
      });
    } catch (err) {
      console.error("Error in /api/staff/team-members:", err);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });
}
