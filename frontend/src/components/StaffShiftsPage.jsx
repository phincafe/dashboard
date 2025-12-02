// src/pages/StaffShiftsPage.jsx
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../App";

function formatTime(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function computeHours(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end - start;
  if (diffMs <= 0) return 0;
  return diffMs / (1000 * 60 * 60); // hours
}

function StaffShiftsPage() {
  const [date, setDate] = useState(() => {
    // default to today in local time, as YYYY-MM-DD
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchShifts() {
      if (!date) return;
      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/staff/shifts?date=${date}`
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `HTTP ${res.status} – ${text || "Failed to load shifts"}`
          );
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Error loading staff shifts:", err);
        setError(err.message || "Failed to load staff shifts");
      } finally {
        setLoading(false);
      }
    }

    fetchShifts();
  }, [date]);

  const locationsById =
    data?.locations?.reduce((acc, loc) => {
      acc[loc.id] = loc.name;
      return acc;
    }, {}) || {};

  // Build enriched rows & business metrics
  const rows = (data?.shifts || []).map((shift) => {
    const hours = computeHours(shift.start_at, shift.end_at);
    const rateCents = shift.wage?.hourly_rate?.amount ?? 0;
    const rate = rateCents / 100; // $/hour
    const cost = hours * rate;

    const locationName =
      locationsById[shift.location_id] || shift.location_id || "Unknown";

    return {
      id: shift.id,
      locationName,
      teamName: shift.team_member_name || shift.team_member_id,
      role: shift.wage?.title || "Team Member",
      startAt: shift.start_at,
      endAt: shift.end_at,
      hours,
      rate,
      cost,
      status: shift.status,
    };
  });

  const totalShifts = rows.length;
  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const totalLaborCost = rows.reduce((sum, r) => sum + r.cost, 0);

  // Per-location breakdown
  const perLocation = rows.reduce((acc, r) => {
    const key = r.locationName;
    if (!acc[key]) {
      acc[key] = { hours: 0, cost: 0, shifts: 0 };
    }
    acc[key].hours += r.hours;
    acc[key].cost += r.cost;
    acc[key].shifts += 1;
    return acc;
  }, {});

  const locationEntries = Object.entries(perLocation);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20 }}>Staff Shifts & Labor</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <label
            style={{ fontSize: 14, color: "#9ca3af", display: "flex", gap: 8 }}
          >
            Date:
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                background: "#020617",
                border: "1px solid #1f2937",
                color: "#e5e7eb",
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: 14,
              }}
            />
          </label>
        </div>
      </div>

      {loading && <div style={{ fontSize: 14 }}>Loading shifts…</div>}
      {error && (
        <div style={{ color: "#f97373", fontSize: 14, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Summary cards */}
      {!loading && !error && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <SummaryCard
              label="Total shifts"
              value={totalShifts.toString()}
              sub="All locations"
            />
            <SummaryCard
              label="Total labor hours"
              value={totalHours.toFixed(1)}
              sub="Sum of all shifts"
            />
            <SummaryCard
              label="Total labor cost"
              value={`$${totalLaborCost.toFixed(2)}`}
              sub="Hours × hourly rate"
            />
            {totalHours > 0 && (
              <SummaryCard
                label="Avg $/hour (blended)"
                value={`$${(totalLaborCost / totalHours).toFixed(2)}`}
                sub="Across all staff"
              />
            )}
          </div>

          {/* Per-location breakdown */}
          {locationEntries.length > 0 && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #111827",
                padding: 12,
                marginBottom: 16,
                background:
                  "radial-gradient(circle at top left, #111827, #020617)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#9ca3af",
                  marginBottom: 8,
                  fontWeight: 500,
                }}
              >
                Labor by location
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {locationEntries.map(([locName, stats]) => (
                  <div
                    key={locName}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #1f2937",
                      padding: "6px 12px",
                      fontSize: 12,
                      background: "rgba(15,23,42,0.9)",
                    }}
                  >
                    <div style={{ fontWeight: 500, color: "#e5e7eb" }}>
                      {locName}
                    </div>
                    <div style={{ color: "#9ca3af" }}>
                      {stats.shifts} shifts · {stats.hours.toFixed(1)} hrs · $
                      {stats.cost.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed table */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #111827",
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#020617",
                    borderBottom: "1px solid #1f2937",
                  }}
                >
                  <Th>Location</Th>
                  <Th>Employee</Th>
                  <Th>Role</Th>
                  <Th>Start</Th>
                  <Th>End</Th>
                  <Th>Hours</Th>
                  <Th>$ / hr</Th>
                  <Th>Shift cost</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        textAlign: "center",
                        padding: 12,
                        color: "#6b7280",
                      }}
                    >
                      No shifts found for this date.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid #111827",
                      background: "rgba(15,23,42,0.75)",
                    }}
                  >
                    <Td>{row.locationName}</Td>
                    <Td>{row.teamName}</Td>
                    <Td>{row.role}</Td>
                    <Td>{formatTime(row.startAt)}</Td>
                    <Td>{formatTime(row.endAt)}</Td>
                    <Td>{row.hours.toFixed(2)}</Td>
                    <Td>
                      {row.rate > 0 ? `$${row.rate.toFixed(2)}` : "-"}
                    </Td>
                    <Td>
                      {row.cost > 0 ? `$${row.cost.toFixed(2)}` : "-"}
                    </Td>
                    <Td>{row.status}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            Labor cost is approximate (hours × hourly wage, based on Square
            breakdown).
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }) {
  return (
    <div
      style={{
        flex: "1 1 150px",
        minWidth: 150,
        borderRadius: 12,
        border: "1px solid #1f2937",
        padding: 12,
        background: "rgba(15,23,42,0.95)",
      }}
    >
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#f9fafb" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "8px 10px",
        fontWeight: 500,
        color: "#9ca3af",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }) {
  return (
    <td
      style={{
        padding: "6px 10px",
        color: "#e5e7eb",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

export default StaffShiftsPage;
