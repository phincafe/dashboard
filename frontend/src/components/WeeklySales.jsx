// frontend/src/components/WeeklySales.jsx
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

function percentChange(current, previous) {
  if (previous === 0 || previous == null) return null;
  return ((current - previous) / previous) * 100;
}

function WeeklySales() {
  // week anchor = any date in the week
  const [weekDate, setWeekDate] = useState(todayISO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [currentWeek, setCurrentWeek] = useState(null);
  const [prevWeek, setPrevWeek] = useState(null);

  async function fetchWeekly() {
    setLoading(true);
    setError("");
    setCurrentWeek(null);
    setPrevWeek(null);

    try {
      // current week
      const curUrl = new URL("/api/sales/weekly", API_BASE_URL);
      curUrl.searchParams.set("week", weekDate);

      const curRes = await fetch(curUrl.toString(), {
        headers: { "Content-Type": "application/json" },
      });
      if (!curRes.ok) {
        const body = await curRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch weekly sales");
      }
      const curJson = await curRes.json();
      setCurrentWeek(curJson);

      // previous week = chosen day - 7 days
      const d = new Date(weekDate);
      d.setDate(d.getDate() - 7);
      const prevWeekISO = d.toISOString().slice(0, 10);

      const prevUrl = new URL("/api/sales/weekly", API_BASE_URL);
      prevUrl.searchParams.set("week", prevWeekISO);

      const prevRes = await fetch(prevUrl.toString(), {
        headers: { "Content-Type": "application/json" },
      });

      if (prevRes.ok) {
        const prevJson = await prevRes.json();
        setPrevWeek(prevJson);
      } else {
        setPrevWeek(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error loading weekly sales");
      setCurrentWeek(null);
      setPrevWeek(null);
    } finally {
      setLoading(false);
    }
  }

  const locations = currentWeek?.locations || [];
  const avgOrder =
    currentWeek && currentWeek.grandTotal && currentWeek.grandCount
      ? currentWeek.grandTotal / currentWeek.grandCount
      : null;

  const prevTotal = prevWeek?.grandTotal ?? null;
  const pct =
    currentWeek?.grandTotal != null && prevTotal != null
      ? percentChange(currentWeek.grandTotal, prevTotal)
      : null;
  const isUp = pct != null && pct >= 0;

  const currentRangeLabel = currentWeek
    ? `${currentWeek.range.start} → ${currentWeek.range.end}`
    : null;
  const prevRangeLabel = prevWeek
    ? `${prevWeek.range.start} → ${prevWeek.range.end}`
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
          Any date in week:&nbsp;
          <input
            type="date"
            value={weekDate}
            onChange={(e) => setWeekDate(e.target.value)}
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
          onClick={fetchWeekly}
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
          {loading ? "Loading…" : "Load weekly sales"}
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
      {currentWeek && (
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
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Week range</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {currentRangeLabel}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                TZ: {currentWeek.timezone}
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
                {currentWeek.grandTotalFormatted}
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
                {currentWeek.grandCount ?? "-"}
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
                {currentWeek.locationsCount ?? locations.length}
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
                Vs previous week
              </div>
              {prevTotal == null ? (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  No data for previous week.
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
                      {Math.abs(pct).toFixed(1)}% vs previous week
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
              Per-location weekly performance
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

export default WeeklySales;
