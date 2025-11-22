// frontend/src/components/DailySales.jsx
import React, { useState } from "react";
import { API_BASE_URL } from "../App";

const todayISO = new Date().toISOString().slice(0, 10);

function formatCurrency(v) {
  if (v == null || Number.isNaN(v)) return "-";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function computeChange(current, prev) {
  if (!prev || typeof current !== "number" || typeof prev !== "number") {
    return null;
  }
  if (prev === 0) return null;

  const diff = current - prev;
  const pct = (diff / prev) * 100;
  return { diff, pct };
}

function formatChangeLabel(label, change) {
  if (!change || change.pct == null) return `${label}: N/A`;

  const sign = change.pct >= 0 ? "+" : "";
  const color =
    change.pct > 0 ? "#22c55e" : change.pct < 0 ? "#ef4444" : "#9ca3af";

  return (
    <div style={{ fontSize: 11, marginTop: 2, color }}>
      {label}: {sign}
      {change.pct.toFixed(1)}% ({change.diff >= 0 ? "+" : ""}
      {formatCurrency(Math.abs(change.diff))})
    </div>
  );
}

function DailySales() {
  const [date, setDate] = useState(todayISO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  // { lastWeek, lastMonth, lastYear }
  const [comparisons, setComparisons] = useState(null);

  async function fetchOneDay(dateISO) {
    const url = new URL("/api/sales", API_BASE_URL);
    url.searchParams.set("date", dateISO);

    const res = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
        // If you set BASIC_AUTH_PASSCODE in backend, add it here:
        // "x-passcode": "your-passcode-here",
      },
    });

    if (!res.ok) {
      // For comparison fetches we just return null on error
      return null;
    }
    return res.json();
  }

  async function fetchDaily() {
    setLoading(true);
    setError("");
    setComparisons(null);

    try {
      // 1) Fetch current day
      const currentRes = await fetchOneDay(date);
      if (!currentRes) {
        throw new Error("Failed to fetch daily sales");
      }
      setData(currentRes);

      // 2) Build comparison dates
      const currentDateObj = new Date(date);
      if (Number.isNaN(currentDateObj.getTime())) {
        throw new Error("Invalid date");
      }

      const prevWeek = new Date(currentDateObj);
      prevWeek.setDate(prevWeek.getDate() - 7);

      const prevMonth = new Date(currentDateObj);
      prevMonth.setMonth(prevMonth.getMonth() - 1);

      const prevYear = new Date(currentDateObj);
      prevYear.setFullYear(prevYear.getFullYear() - 1);

      const prevWeekISO = prevWeek.toISOString().slice(0, 10);
      const prevMonthISO = prevMonth.toISOString().slice(0, 10);
      const prevYearISO = prevYear.toISOString().slice(0, 10);

      // 3) Fetch comparisons in parallel
      const [lastWeek, lastMonth, lastYear] = await Promise.all([
        fetchOneDay(prevWeekISO),
        fetchOneDay(prevMonthISO),
        fetchOneDay(prevYearISO),
      ]);

      setComparisons({
        lastWeek,
        lastMonth,
        lastYear,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Error loading daily sales");
      setData(null);
      setComparisons(null);
    } finally {
      setLoading(false);
    }
  }

  const locations = data?.locations || [];
  const avgOrderChain =
    data && data.grandTotal && data.grandCount
      ? data.grandTotal / data.grandCount
      : null;

  // Overall comparison (all locations)
  const overallLastWeekChange = computeChange(
    data?.grandTotal,
    comparisons?.lastWeek?.grandTotal
  );
  const overallLastMonthChange = computeChange(
    data?.grandTotal,
    comparisons?.lastMonth?.grandTotal
  );
  const overallLastYearChange = computeChange(
    data?.grandTotal,
    comparisons?.lastYear?.grandTotal
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          onClick={fetchDaily}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            border: "none",
            background: "#22c55e",
            color: "#052e16",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading…" : "Load daily sales + compare"}
        </button>
      </div>

      {/* Errors */}
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

      {/* Data */}
      {data && (
        <>
          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #1f2937",
                background:
                  "radial-gradient(circle at top, #0f172a, #020617 70%)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Date</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{data.date}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                TZ: {data.timezone}
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #14532d",
                background: "rgba(22,163,74,0.12)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Total sales</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {data.grandTotalFormatted}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Across all locations
              </div>

              {/* Overall comparisons */}
              {comparisons && (
                <div style={{ marginTop: 6 }}>
                  {formatChangeLabel("vs same day last week", overallLastWeekChange)}
                  {formatChangeLabel("vs same date last month", overallLastMonthChange)}
                  {formatChangeLabel("vs same date last year", overallLastYearChange)}
                </div>
              )}
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #1d4ed8",
                background: "rgba(37,99,235,0.12)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Orders</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {data.grandCount ?? "-"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Avg ticket: {formatCurrency(avgOrderChain)}
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #6b21a8",
                background: "rgba(147,51,234,0.12)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Locations</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {data.locationsCount}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                With at least 1 payment
              </div>
            </div>
          </div>

          {/* Locations table/cards */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 13,
                color: "#9ca3af",
                marginBottom: 6,
              }}
            >
              Per-location daily performance (with comparisons)
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 10,
              }}
            >
              {locations.map((loc) => {
                const avg =
                  loc.total && loc.count ? loc.total / loc.count : null;

                // Find same-location entries in comparison reports
                const lastWeekLoc =
                  comparisons?.lastWeek?.locations?.find(
                    (l) => l.locationId === loc.locationId
                  ) || null;
                const lastMonthLoc =
                  comparisons?.lastMonth?.locations?.find(
                    (l) => l.locationId === loc.locationId
                  ) || null;
                const lastYearLoc =
                  comparisons?.lastYear?.locations?.find(
                    (l) => l.locationId === loc.locationId
                  ) || null;

                const locLastWeekChange = lastWeekLoc
                  ? computeChange(loc.total, lastWeekLoc.total)
                  : null;
                const locLastMonthChange = lastMonthLoc
                  ? computeChange(loc.total, lastMonthLoc.total)
                  : null;
                const locLastYearChange = lastYearLoc
                  ? computeChange(loc.total, lastYearLoc.total)
                  : null;

                return (
                  <div
                    key={loc.locationId}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid #111827",
                      background:
                        "linear-gradient(135deg, #020617 0%, #020617 60%, #020617 100%)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#e5e7eb",
                        }}
                      >
                        {loc.locationName}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 8,
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <div style={{ color: "#9ca3af" }}>Total</div>
                        <div style={{ fontWeight: 600 }}>
                          {loc.totalFormatted}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af" }}>Orders</div>
                        <div style={{ fontWeight: 600 }}>{loc.count}</div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af" }}>Avg ticket</div>
                        <div style={{ fontWeight: 600 }}>
                          {formatCurrency(avg)}
                        </div>
                      </div>
                    </div>

                    {/* Per-location comparison rows */}
                    {comparisons && (
                      <div style={{ marginTop: 6 }}>
                        {formatChangeLabel(
                          "vs same day last week",
                          locLastWeekChange
                        )}
                        {formatChangeLabel(
                          "vs same date last month",
                          locLastMonthChange
                        )}
                        {formatChangeLabel(
                          "vs same date last year",
                          locLastYearChange
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {locations.length === 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  No locations in this report.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DailySales;
