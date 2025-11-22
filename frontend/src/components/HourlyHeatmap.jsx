import React, { useState } from "react";
import { API_BASE_URL } from "../App";

const todayISO = new Date().toISOString().slice(0, 10);
const thisMonth = todayISO.slice(0, 7); // YYYY-MM
const thisYear = todayISO.slice(0, 4);  // YYYY

function buildHourLabel(h) {
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:00 ${suffix}`;
}

function HourlyHeatmap() {
  const [mode, setMode] = useState("daily"); // daily | weekly | monthly | yearly
  const [dailyDate, setDailyDate] = useState(todayISO);
  const [weeklyDate, setWeeklyDate] = useState(todayISO);
  const [monthlyMonth, setMonthlyMonth] = useState(thisMonth);
  const [yearlyYear, setYearlyYear] = useState(thisYear);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      let url;
      if (mode === "daily") {
        url = new URL("/api/sales/hourly", API_BASE_URL);
        url.searchParams.set("date", dailyDate);
        url.searchParams.set("comparePrev", "true");
      } else if (mode === "weekly") {
        url = new URL("/api/sales/hourly/weekly", API_BASE_URL);
        url.searchParams.set("week", weeklyDate);
        url.searchParams.set("comparePrev", "true");
      } else if (mode === "monthly") {
        url = new URL("/api/sales/hourly/monthly", API_BASE_URL);
        url.searchParams.set("month", monthlyMonth); // YYYY-MM
        url.searchParams.set("comparePrev", "true");
      } else if (mode === "yearly") {
        url = new URL("/api/sales/hourly/yearly", API_BASE_URL);
        url.searchParams.set("year", yearlyYear);
        url.searchParams.set("comparePrev", "true");
      }

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          "x-passcode": "7238", // your passcode
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch hourly sales");
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || "Error loading hourly sales");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function hourlyObjectToArray(hourlyObj) {
    if (!hourlyObj) return [];
    return Object.keys(hourlyObj)
      .map((key) => {
        const h = Number(key);
        return { hour: h, ...hourlyObj[key] };
      })
      .sort((a, b) => a.hour - b.hour);
  }

  const hourly = hourlyObjectToArray(data?.hourly);
  const comparisonHourly = data?.comparison
    ? hourlyObjectToArray(data.comparison.hourly)
    : [];

  const max = data?.maxHourAllLocations || 0;

  function cellBackground(v) {
    if (!max || !v) return "transparent";
    const ratio = Math.min(1, v / max);
    return `rgba(34,197,94,${0.15 + 0.7 * ratio})`;
  }

  const hasComparison = !!data?.comparison;

  // Header label for current period
  let mainLabel = "";
  if (mode === "daily") {
    mainLabel = data?.includeDate || data?.date || dailyDate;
  } else if (data?.range) {
    mainLabel = `${data.range.start} → ${data.range.end}`;
  }

  const locations = data?.locations || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mode tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        {[
          { id: "daily", label: "Daily" },
          { id: "weekly", label: "Weekly" },
          { id: "monthly", label: "Monthly" },
          { id: "yearly", label: "Yearly" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            style={{
              borderRadius: 999,
              padding: "6px 14px",
              border: "1px solid #374151",
              background:
                mode === tab.id ? "#111827" : "rgba(15,23,42,0.4)",
              color: mode === tab.id ? "#f9fafb" : "#9ca3af",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        {mode === "daily" && (
          <label style={{ fontSize: 14 }}>
            Date:&nbsp;
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
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
        )}

        {mode === "weekly" && (
          <label style={{ fontSize: 14 }}>
            Any day in week:&nbsp;
            <input
              type="date"
              value={weeklyDate}
              onChange={(e) => setWeeklyDate(e.target.value)}
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
        )}

        {mode === "monthly" && (
          <label style={{ fontSize: 14 }}>
            Month:&nbsp;
            <input
              type="month"
              value={monthlyMonth}
              onChange={(e) => setMonthlyMonth(e.target.value)}
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
        )}

        {mode === "yearly" && (
          <label style={{ fontSize: 14 }}>
            Year:&nbsp;
            <input
              type="number"
              value={yearlyYear}
              onChange={(e) => setYearlyYear(e.target.value)}
              style={{
                width: 90,
                background: "#020617",
                color: "#e5e7eb",
                borderRadius: 6,
                border: "1px solid #374151",
                padding: "6px 8px",
                fontSize: 13,
              }}
            />
          </label>
        )}

        <button
          onClick={fetchData}
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
          {loading ? "Loading…" : "Load"}
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

      {/* Summary cards */}
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
              flex: "1 1 160px",
              padding: 12,
              borderRadius: 12,
              border: "1px solid #1f2937",
              background: "rgba(15,23,42,0.9)",
            }}
          >
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {mode.toUpperCase()} RANGE
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
              {mainLabel || "–"}
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
            <div style={{ fontSize: 11, color: "#9ca3af" }}>TOTAL SALES</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              ${data.totalAllLocations?.toFixed(2) ?? "0.00"}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              Across {data.locations?.length || 0} locations
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
            <div style={{ fontSize: 11, color: "#9ca3af" }}>ORDERS</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              {data.totalCountAllLocations ?? 0}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              All hours 5 AM – 8 PM
            </div>
          </div>

          {hasComparison && <ComparisonCard data={data} mode={mode} />}
        </div>
      )}

      {/* Hourly all-location table */}
      {data && (
        <div>
          <div
            style={{
              fontSize: 13,
              color: "#9ca3af",
              marginBottom: 4,
            }}
          >
            Hourly profile (5 AM – 8 PM, all locations)
            {hasComparison && " · Compared to previous period"}
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
                minWidth: hasComparison ? 720 : 480,
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
                    Hour
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: 8,
                      borderBottom: "1px solid #111827",
                    }}
                  >
                    Total
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: 8,
                      borderBottom: "1px solid #111827",
                    }}
                  >
                    Orders
                  </th>

                  {hasComparison && (
                    <>
                      <th
                        style={{
                          textAlign: "right",
                          padding: 8,
                          borderBottom: "1px solid #111827",
                        }}
                      >
                        Prev Total
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: 8,
                          borderBottom: "1px solid #111827",
                        }}
                      >
                        Prev Orders
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: 8,
                          borderBottom: "1px solid #111827",
                        }}
                      >
                        Δ $
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: 8,
                          borderBottom: "1px solid #111827",
                        }}
                      >
                        Δ %
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {hourly.map((bucket) => {
                  const prev =
                    comparisonHourly.find((b) => b.hour === bucket.hour) ||
                    {};
                  const prevTotal = prev.totalAllLocations || 0;
                  const prevCount = prev.countAllLocations || 0;
                  const diff = bucket.totalAllLocations - prevTotal;
                  const diffPct =
                    prevTotal > 0
                      ? (diff / prevTotal) * 100
                      : bucket.totalAllLocations > 0
                      ? 100
                      : 0;

                  return (
                    <tr key={bucket.hour}>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #0b1120",
                        }}
                      >
                        {buildHourLabel(bucket.hour)}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #0b1120",
                          textAlign: "right",
                          background: cellBackground(
                            bucket.totalAllLocations
                          ),
                        }}
                      >
                        ${bucket.totalAllLocations.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #0b1120",
                          textAlign: "right",
                          color: "#e5e7eb",
                        }}
                      >
                        {bucket.countAllLocations}
                      </td>

                      {hasComparison && (
                        <>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                              textAlign: "right",
                              color: "#9ca3af",
                            }}
                          >
                            ${prevTotal.toFixed(2)}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                              textAlign: "right",
                              color: "#9ca3af",
                            }}
                          >
                            {prevCount}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                              textAlign: "right",
                              color:
                                diff > 0
                                  ? "#4ade80"
                                  : diff < 0
                                  ? "#f97373"
                                  : "#e5e7eb",
                            }}
                          >
                            {diff === 0
                              ? "—"
                              : `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              borderBottom: "1px solid #0b1120",
                              textAlign: "right",
                              color:
                                diffPct > 0
                                  ? "#4ade80"
                                  : diffPct < 0
                                  ? "#f97373"
                                  : "#e5e7eb",
                            }}
                          >
                            {prevTotal === 0 &&
                            bucket.totalAllLocations === 0
                              ? "—"
                              : `${diffPct > 0 ? "+" : ""}${diffPct.toFixed(
                                  1
                                )}%`}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}

                {hourly.length === 0 && (
                  <tr>
                    <td
                      colSpan={hasComparison ? 7 : 3}
                      style={{
                        padding: 8,
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      No hourly data returned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-store breakdown */}
      {data && locations.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 13,
              color: "#9ca3af",
              marginBottom: 4,
            }}
          >
            Per-store hourly breakdown (sales per location)
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
                    Hour
                  </th>
                  {locations.map((loc) => (
                    <th
                      key={loc.id}
                      style={{
                        textAlign: "right",
                        padding: 8,
                        borderBottom: "1px solid #111827",
                      }}
                    >
                      {loc.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hourly.map((bucket) => (
                  <tr key={bucket.hour}>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #0b1120",
                      }}
                    >
                      {buildHourLabel(bucket.hour)}
                    </td>
                    {locations.map((loc) => {
                      const val =
                        bucket.totalsByLocation?.[loc.id] != null
                          ? bucket.totalsByLocation[loc.id]
                          : 0;
                      return (
                        <td
                          key={loc.id}
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #0b1120",
                            textAlign: "right",
                            color: val === 0 ? "#4b5563" : "#e5e7eb",
                          }}
                        >
                          {val === 0 ? "—" : `$${val.toFixed(2)}`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {hourly.length === 0 && (
                  <tr>
                    <td
                      colSpan={1 + locations.length}
                      style={{
                        padding: 8,
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      No data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonCard({ data, mode }) {
  const comp = data.comparison;
  if (!comp) return null;

  const thisTotal = data.totalAllLocations || 0;
  const prevTotal = comp.totalAllLocations || 0;
  const diff = thisTotal - prevTotal;
  const diffPct =
    prevTotal > 0 ? (diff / prevTotal) * 100 : thisTotal > 0 ? 100 : 0;

  let title;
  if (mode === "daily") title = "VS LAST WEEK (same weekday)";
  else if (mode === "weekly") title = "VS PREVIOUS WEEK";
  else if (mode === "monthly") title = "VS PREVIOUS MONTH";
  else if (mode === "yearly") title = "VS PREVIOUS YEAR";
  else title = "VS PREVIOUS PERIOD";

  let currentLabel;
  let prevLabel;

  if (mode === "daily") {
    currentLabel = data.includeDate || data.date;
    prevLabel = comp.includeDate;
  } else {
    currentLabel = data.range
      ? `${data.range.start} → ${data.range.end}`
      : "Current period";
    prevLabel = comp.range
      ? `${comp.range.start} → ${comp.range.end}`
      : "Previous period";
  }

  return (
    <div
      style={{
        flex: "1 1 220px",
        padding: 12,
        borderRadius: 12,
        border: "1px solid #1f2937",
        background: "rgba(15,23,42,0.9)",
      }}
    >
      <div style={{ fontSize: 11, color: "#9ca3af" }}>{title}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
        {prevLabel}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 8,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 500 }}>
          Prev: ${prevTotal.toFixed(2)}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: diff > 0 ? "#4ade80" : diff < 0 ? "#f97373" : "#e5e7eb",
          }}
        >
          {diff === 0
            ? "No change"
            : `${diff > 0 ? "+" : ""}${diff.toFixed(2)} (${diffPct.toFixed(
                1
              )}%)`}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
        Current: {currentLabel}
      </div>
    </div>
  );
}

export default HourlyHeatmap;
