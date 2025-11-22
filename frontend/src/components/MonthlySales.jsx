// frontend/src/components/MonthlySales.jsx
import React, { useState } from "react";
import { API_BASE_URL } from "../App";

const now = new Date();
const thisMonthDefault = `${now.getFullYear()}-${String(
  now.getMonth() + 1
).padStart(2, "0")}`;

function formatCurrency(v) {
  if (v == null || Number.isNaN(v)) return "-";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function percentChange(current, previous) {
  if (previous === 0 || previous == null) return null;
  return ((current - previous) / previous) * 100;
}

function MonthlySales() {
  const [month, setMonth] = useState(thisMonthDefault); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [currentMonth, setCurrentMonth] = useState(null);
  const [prevMonth, setPrevMonth] = useState(null);

  function calcPrevMonthStr(m) {
    const [yStr, mStr] = m.split("-");
    const y = parseInt(yStr, 10);
    const mo = parseInt(mStr, 10);
    const d = new Date(y, mo - 1, 1);
    d.setMonth(d.getMonth() - 1);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yy}-${mm}`;
  }

  async function fetchMonthly() {
    setLoading(true);
    setError("");
    setCurrentMonth(null);
    setPrevMonth(null);

    try {
      // current month
      const curUrl = new URL("/api/sales/monthly", API_BASE_URL);
      curUrl.searchParams.set("month", month);

      const curRes = await fetch(curUrl.toString(), {
        headers: { "Content-Type": "application/json" },
      });
      if (!curRes.ok) {
        const body = await curRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch monthly sales");
      }
      const curJson = await curRes.json();
      setCurrentMonth(curJson);

      // previous month
      const prevStr = calcPrevMonthStr(month);
      const prevUrl = new URL("/api/sales/monthly", API_BASE_URL);
      prevUrl.searchParams.set("month", prevStr);

      const prevRes = await fetch(prevUrl.toString(), {
        headers: { "Content-Type": "application/json" },
      });
      if (prevRes.ok) {
        const prevJson = await prevRes.json();
        setPrevMonth(prevJson);
      } else {
        setPrevMonth(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error loading monthly sales");
      setCurrentMonth(null);
      setPrevMonth(null);
    } finally {
      setLoading(false);
    }
  }

  const locations = currentMonth?.locations || [];
  const avgOrder =
    currentMonth && currentMonth.grandTotal && currentMonth.grandCount
      ? currentMonth.grandTotal / currentMonth.grandCount
      : null;

  const prevTotal = prevMonth?.grandTotal ?? null;
  const pct =
    currentMonth?.grandTotal != null && prevTotal != null
      ? percentChange(currentMonth.grandTotal, prevTotal)
      : null;
  const isUp = pct != null && pct >= 0;

  const currentRangeLabel = currentMonth
    ? `${currentMonth.range.start} → ${currentMonth.range.end}`
    : null;
  const prevRangeLabel = prevMonth
    ? `${prevMonth.range.start} → ${prevMonth.range.end}`
    : null;

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
          Month:&nbsp;
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
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
          onClick={fetchMonthly}
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
          {loading ? "Loading…" : "Load monthly sales"}
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

      {/* Data */}
      {currentMonth && (
        <>
          {/* Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {/* Range card */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #1f2937",
                background:
                  "radial-gradient(circle at top, #0f172a, #020617 70%)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Month range</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {currentRangeLabel}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                TZ: {currentMonth.timezone}
              </div>
            </div>

            {/* Total */}
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
                {currentMonth.grandTotalFormatted}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Across all locations
              </div>
            </div>

            {/* Orders */}
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
                {currentMonth.grandCount ?? "-"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Avg ticket: {formatCurrency(avgOrder)}
              </div>
            </div>

            {/* Locations */}
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
                {currentMonth.locationsCount ?? locations.length}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                With at least 1 payment
              </div>
            </div>

            {/* Comparison card */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #4b5563",
                background: "rgba(75,85,99,0.16)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Vs previous month
              </div>
              {prevTotal == null ? (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  No data for previous month.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 14,
                      marginTop: 4,
                      color: "#e5e7eb",
                    }}
                  >
                    {formatCurrency(prevTotal)} from {prevRangeLabel}
                  </div>
                  {pct != null && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 13,
                        fontWeight: 600,
                        color: isUp ? "#4ade80" : "#fb7185",
                      }}
                    >
                      {isUp ? "▲" : "▼"}{" "}
                      {Math.abs(pct).toFixed(1)}% vs previous month
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Per-location */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 13,
                color: "#9ca3af",
                marginBottom: 6,
              }}
            >
              Per-location monthly performance
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
                        <div style={{ fontWeight: 600 }}>
                          {loc.count ?? "-"}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af" }}>Avg ticket</div>
                        <div style={{ fontWeight: 600 }}>
                          {formatCurrency(avg)}
                        </div>
                      </div>
                    </div>
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

export default MonthlySales;
