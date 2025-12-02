// staffRoutes.js
import { DateTime } from "luxon";
import { SquareError } from "square";

export function registerStaffRoutes(app, client) {
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

      // 1) Locations (for names in UI)
      const locationsResp = await client.locations.list();
      const locationsRaw =
        locationsResp.result?.locations || locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));
      const locationIds = locations.map((l) => l.id);

      // 2) Build body like your working cURL (snake_case!)
      const startUtc = dayStart.toUTC().toISO();
      const endUtc = dayEnd.toUTC().toISO();

      const laborBody = {
        query: {
          filter: {
            location_ids: locationIds,
            start: {
              start_at: startUtc,
              end_at: endUtc,
            },
            // status: "CLOSED", // optional
          },
        },
        limit: 200,
      };

      // 3) Call Labor API directly
      const shiftResp = await fetch(
        "https://connect.squareup.com/v2/labor/shifts/search",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(laborBody),
        }
      );

      if (!shiftResp.ok) {
        const errorText = await shiftResp.text().catch(() => "");
        console.error(
          "[staffRoutes] Labor searchShifts HTTP error:",
          shiftResp.status,
          errorText
        );
        return res.status(502).json({
          error: "Square Labor API error",
          status: shiftResp.status,
          body: errorText,
        });
      }

      const shiftJson = await shiftResp.json();
      const rawShifts = shiftJson.shifts || [];

      // 4) Fetch team members to map IDs -> names
      const teamMap = await fetchTeamMemberMap(accessToken);

      // 5) Enrich shifts with team_member_name
      const shifts = rawShifts.map((shift) => {
        const tmId =
          shift.team_member_id ||
          shift.teamMemberId ||
          shift.employee_id ||
          shift.employeeId;

        const member = tmId ? teamMap[tmId] : null;

        const displayName = member
          ? [member.given_name, member.family_name]
              .filter(Boolean)
              .join(" ")
          : tmId || "Unknown";

        return {
          ...shift,
          team_member_id: tmId,
          team_member_name: displayName,
        };
      });

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

/**
 * Fetch all team members and build a map: id -> member object
 * Uses GET /v2/team-members
 */
async function fetchTeamMemberMap(accessToken) {
  const url = "https://connect.squareup.com/v2/team-members?limit=200";

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error(
        "[staffRoutes] Team members HTTP error:",
        resp.status,
        text
      );
      return {};
    }

    const json = await resp.json();
    const members = json.team_members || [];
    const map = {};

    for (const m of members) {
      if (!m.id) continue;
      map[m.id] = m;
    }

    console.log(
      `[staffRoutes] Loaded ${members.length} team members into map`
    );

    return map;
  } catch (err) {
    console.error("Error fetching team members:", err);
    return {};
  }
}
