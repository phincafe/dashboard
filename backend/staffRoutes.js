// staffRoutes.js
import { DateTime } from "luxon";

// Helper: call Square REST API with fetch
async function squarePost(path, body) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing SQUARE_ACCESS_TOKEN env var");
  }

  const url = `https://connect.squareup.com${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    console.error(`[Square POST ${path}] HTTP ${resp.status}`, json);
    const err = new Error(`Square API error: ${resp.status}`);
    err.square = json;
    throw err;
  }

  return json;
}

/**
 * Build a map of team_member_id -> team member object via /v2/team-members/search
 */
async function fetchTeamMemberMap() {
  const map = {};

  try {
    const json = await squarePost("/v2/team-members/search", {
      query: {
        filter: {
          status: "ACTIVE",
        },
      },
      limit: 200,
    });

    // Square returns team_members
    const teamMembers =
      json.team_members ||
      json.teamMembers ||
      [];

    for (const m of teamMembers) {
      if (!m) continue;

      const id = m.id || m.team_member_id || m.teamMemberId;
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

      // Locations using existing Square client (this part already works)
      const locationsResp = await client.locations.list();
      const locationsRaw =
        locationsResp.result?.locations || locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));
      const locationIds = locations.map((l) => l.id);

      // Time window (UTC) for this day – same as your working curl
      const startUtc = dayStart.toUTC().toISO(); // 00:00 UTC
      const endUtc = dayEnd.toUTC().toISO();     // 23:59:59 UTC

      const laborBody = {
        query: {
          filter: {
            location_ids: locationIds,   // snake_case for raw REST
            start: {
              start_at: startUtc,
              end_at: endUtc,
            },
            status: "CLOSED",
          },
        },
        limit: 200,
      };

      // 🔹 Call Labor API via raw HTTP (same as your curl)
      const laborJson = await squarePost("/v2/labor/shifts/search", laborBody);

      const rawShifts =
        laborJson.shifts ||
        laborJson.result?.shifts ||
        [];

      console.log(
        `[staffRoutes] /api/staff/shifts date=${dateStr} rawShifts=${rawShifts.length}`
      );

      // 🔹 Load team member map (id => member object)
      const teamMemberMap = await fetchTeamMemberMap();

      // 🔹 Annotate shifts with team_member_id + team_member_name
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
      const squareDetails = err.square || null;
      if (squareDetails) {
        return res
          .status(502)
          .json({ error: "Square API error", details: squareDetails });
      }
      res.status(500).json({ error: "Unexpected server error" });
    }
  });

  /**
   * Optional debug endpoint so you can see raw team members from Square
   * GET /api/staff/team-members
   */
  app.get("/api/staff/team-members", async (req, res) => {
    try {
      const teamMemberMap = await fetchTeamMemberMap();
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
