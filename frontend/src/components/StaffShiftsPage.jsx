// src/pages/StaffShiftsPage.jsx
import React, { useState } from "react";
import { API_BASE_URL } from "../App";

const todayISO = new Date().toISOString().slice(0, 10);

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function StaffShiftsPage() {
  const [date, setDate] = useState(todayISO);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadShifts() {
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/staff/shifts", API_BASE_URL);
      url.searchParams.set("date", date);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          "x-passcode": "7238", // same as your other endpoints if needed
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load staff shifts");
      }

      const json = await res.json();
      console.log("StaffShiftsPage data:", json); // 👈 debug
      setData(json);
    } catch (err) {
      console.error("Error in StaffShiftsPage:", err);
      setError(err.message || "Error loading staff shifts");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const shifts = data?.shifts || [];
  const locations = data?.locations || [];

  // Group shifts by location for nicer display
  const shiftsByLocation = locations.reduce((acc, loc) => {
    acc[loc.id] = [];
    return acc;
  }, {});

  for (const s of shifts) {
    const locId = s.location_id || s.locationId;
    if (!locId) continue;
    if (!shiftsByLocation[locId]) shiftsByLocation[locId] = [];
    shiftsByLocation[locId].push(s);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label style={{ fontSize: 14 }}>
          Date:&nbsp;
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: "#020617",
              color: "#e5e7eb",
              borderRadius: 6,
              border: "1px solid #374151",
              padding: "6px 8px",
              fontSize: 13,
            }}
          />
        </label>

        <button
          onClick={loadShifts}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            border: "none",
            background: "#38bdf8",
            color: "#0f172a",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading…" : "Load Shifts"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 8,
            borderRadius: 8,
            background: "rgba(220,38,38,0.2)",
            border: "1px solid rgba(220,38,38,0.6)",
            color: "#fecaca",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {data && (
        <>
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginTop: 4,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                flex: "1 1 160px",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #1f2937",
                background: "rgba(15,23,42,0.9)",
              }}
            >
              <div style={{ fontSize: 11, color: "#9ca3af" }}>DATE</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                {data.date}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {data.timezone}
              </div>
            </div>

            <div
              style={{
                flex: "1 1 160px",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #1f2937",
                background: "rgba(15,23,42,0.9)",
              }}
            >
              <div style={{ fontSize: 11, color: "#9ca3af" }}>TOTAL SHIFTS</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                {shifts.length}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                Across {locations.length} locations
              </div>
            </div>
          </div>

          {/* Per-location cards */}
          {locations.map((loc) => {
            const locShifts = shiftsByLocation[loc.id] || [];
            return (
              <div
                key={loc.id}
                style={{
                  marginBottom: 16,
                  borderRadius: 12,
                  border: "1px solid #1f2937",
                  background: "rgba(15,23,42,0.9)",
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{loc.name}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    {locShifts.length} shift
                    {locShifts.length === 1 ? "" : "s"}
                  </span>
                </div>

                {locShifts.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    No shifts for this location.
                  </div>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 6,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          Team Member ID
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 6,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          Role
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 6,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          Start
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 6,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          End
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: 6,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {locShifts.map((shift) => (
                        <tr key={shift.id}>
                          <td
                            style={{
                              padding: 6,
                              borderBottom: "1px solid #020617",
                            }}
                          >
                            {shift.team_member_id ||
                              shift.teamMemberId ||
                              shift.employee_id ||
                              shift.employeeId}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              borderBottom: "1px solid #020617",
                            }}
                          >
                            {shift.wage?.title || "—"}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              borderBottom: "1px solid #020617",
                            }}
                          >
                            {fmtTime(shift.start_at || shift.startAt)}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              borderBottom: "1px solid #020617",
                            }}
                          >
                            {fmtTime(shift.end_at || shift.endAt)}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              borderBottom: "1px solid #020617",
                              textAlign: "right",
                            }}
                          >
                            {shift.status || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </>
      )}

      {!data && !error && !loading && (
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Pick a date and click <b>Load Shifts</b> to see who worked that day.
        </div>
      )}
    </div>
  );
}
