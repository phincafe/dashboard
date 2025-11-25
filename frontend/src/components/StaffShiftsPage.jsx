// StaffShiftsPage.jsx
import React, { useState } from "react";
import { API_BASE_URL } from "../App";

const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function formatTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function durationHours(startIso, endIso) {
  if (!startIso || !endIso) return "—";
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end - start;
  if (diffMs <= 0 || Number.isNaN(diffMs)) return "—";
  const hours = diffMs / (1000 * 60 * 60);
  return hours.toFixed(2);
}

function centsToDollars(cents) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default function StaffShiftsPage() {
  const [date, setDate] = useState(todayISO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  async function fetchShifts() {
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/labor/shifts", API_BASE_URL);
      url.searchParams.set("date", date);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          "x-passcode": "7238", // same passcode you use elsewhere
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load shifts");
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || "Error loading shifts");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const shifts = data?.shifts || [];

  // Group by location for nicer display
  const shiftsByLocation = shifts.reduce((acc, s) => {
    const locId = s.locationId || "UNKNOWN";
    if (!acc[locId]) acc[locId] = [];
    acc[locId].push(s);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600 }}>Staff Shifts (Labor)</h2>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
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
          onClick={fetchShifts}
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

      {/* Error */}
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

      {/* Summary */}
      {data && (
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
              flex: "1 1 180px",
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
              flex: "1 1 180px",
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
          </div>
        </div>
      )}

      {/* Table */}
      {data && (
        <div>
          <div
            style={{
              fontSize: 13,
              color: "#9ca3af",
              marginBottom: 4,
            }}
          >
            Shifts for {data.date} (by location)
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {Object.keys(shiftsByLocation).length === 0 && (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                No shifts found for this date.
              </div>
            )}

            {Object.entries(shiftsByLocation).map(([locId, locShifts]) => (
              <div key={locId}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#e5e7eb",
                  }}
                >
                  Location: {locId}
                </div>

                <div
                  style={{
                    overflowX: "auto",
                    borderRadius: 10,
                    border: "1px solid #111827",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                      minWidth: 600,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background:
                            "linear-gradient(to right, #020617, #020617, #020617)",
                        }}
                      >
                        <th
                          style={{
                            textAlign: "left",
                            padding: 8,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          Team Member ID
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 8,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          Role
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 8,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          Start
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 8,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          End
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: 8,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          Hours
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: 8,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          Hourly Rate
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 8,
                            borderBottom: "1px solid #111827",
                          }}
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {locShifts.map((s) => (
                        <tr key={s.id}>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                            }}
                          >
                            {s.teamMemberId || s.employeeId || "—"}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                            }}
                          >
                            {s.wageTitle || "—"}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                            }}
                          >
                            {formatTime(s.startAt)}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                            }}
                          >
                            {formatTime(s.endAt)}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                              textAlign: "right",
                            }}
                          >
                            {durationHours(s.startAt, s.endAt)}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                              textAlign: "right",
                            }}
                          >
                            {centsToDollars(s.hourlyRateCents)}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                            }}
                          >
                            {s.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
