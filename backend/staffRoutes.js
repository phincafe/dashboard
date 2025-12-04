// staffRoutes.js
import { DateTime } from "luxon";
import { SquareError } from "square";

/**
 * Helper: fetch locations for a given Square access token using raw HTTP
 * (used for the Bollinger account).
 */
async function fetchLocationsForToken(accessToken) {
  const resp = await fetch("https://connect.squareup.com/v2/locations", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("[staffRoutes] locations API error:", resp.status, text);
    throw new Error("Square locations API error");
  }

  const json = await resp.json();
  const list = json.locations || json.result?.locations || [];
  return list.map((loc) => ({
    id: loc.id,
    name: loc.name || loc.id,
  }));
}

/**
 * Helper: for a single Square account
 * - fetch shifts within [startUtc, endUtc]
 * - fetch team-member names
 * - return { locations, shifts }
 */
async function fetchShiftsForAccount({
  accessToken,
  locations,
  startUtc,
  endUtc,
}) {
  const locationIds = locations.map((l) => l.id);

  // 1) Labor API – searchShifts
  const shiftsBody = {
    query: {
      filter: {
        location_ids: locationIds, // snake_case for HTTP JSON
        start: {
          start_at: startUtc,
          end_at: endUtc,
        },
        // status: "CLOSED", // uncomment if you only want closed shifts
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
    throw new Error("Square Labor API error");
  }

  const shiftsJson = await shiftsResp.json();
  const shiftsRaw = shiftsJson.shifts || [];

  // 2) collect team_member_ids
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

  // 3) fetch team members for this account
  let teamMembersMap = {};
  if (teamMemberIds.length > 0) {
    const tmBody = {
      team_member_ids: teamMemberIds,
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

  // 4) attach team_member_name
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

  return { locations, shifts };
}

export function registerStaffRoutes(app, client) {
  /**
   * GET /api/staff/shifts?date=YYYY-MM-DD
   *
   * Now supports TWO Square accounts:
   * - main account via SDK client + SQUARE_ACCESS_TOKEN_MAIN
   * - Bollinger account via SQUARE_ACCESS_TOKEN_BOLLINGER
   */
  app.get("/api/staff/shifts", async (req, res) => {
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";
    const dateStr = req.query.date;

    if (!dateStr) {
      return res.status(400).json({ error: "Missing date=YYYY-MM-DD" });
    }

    const mainToken =
      process.env.SQUARE_ACCESS_TOKEN_MAIN ||
      process.env.SQUARE_ACCESS_TOKEN;
    if (!mainToken) {
      return res
        .status(500)
        .json({ error: "Missing SQUARE_ACCESS_TOKEN_MAIN" });
    }

    const bollingerToken = process.env.SQUARE_ACCESS_TOKEN_BOLLINGER || null;
    const bollingerLocationId =
      process.env.SQUARE_BOLLINGER_LOCATION_ID || "L6MN53EG1QWS3";

    try {
      const dayStart = DateTime.fromISO(dateStr, { zone: timezone }).startOf(
        "day"
      );
      const dayEnd = dayStart.endOf("day");

      if (!dayStart.isValid) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const startUtc = dayStart.toUTC().toISO();
      const endUtc = dayEnd.toUTC().toISO();

      // ---------- MAIN ACCOUNT (Blossom / Fremont / Campbell) ----------
      const locationsResp = await client.locations.list();
      const locationsRaw =
        locationsResp.result?.locations || locationsResp.locations || [];
      const mainLocations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));

      const mainData = await fetchShiftsForAccount({
        accessToken: mainToken,
        locations: mainLocations,
        startUtc,
        endUtc,
      });

      // ---------- BOLLINGER ACCOUNT (separate Square account) ----------
      let bollingerData = { locations: [], shifts: [] };
      if (bollingerToken) {
        // fetch locations for that token, then optionally filter to Bollinger
        let bollingerLocations = await fetchLocationsForToken(bollingerToken);

        // if you only want one location, filter here
        bollingerLocations = bollingerLocations.filter(
          (loc) => loc.id === bollingerLocationId
        );

        if (bollingerLocations.length > 0) {
          bollingerData = await fetchShiftsForAccount({
            accessToken: bollingerToken,
            locations: bollingerLocations,
            startUtc,
            endUtc,
          });
        }
      }

      // ---------- MERGE ----------
      const allLocations = [...mainData.locations, ...bollingerData.locations];
      const allShifts = [...mainData.shifts, ...bollingerData.shifts];

      console.log(
        `[staffRoutes] /api/staff/shifts date=${dateStr} totalShifts=${allShifts.length}`
      );

      res.json({
        date: dateStr,
        timezone,
        locations: allLocations,
        shifts: allShifts,
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
