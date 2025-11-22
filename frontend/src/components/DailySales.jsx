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

function percentChange(current, previous) {
  if (previous === 0 || previous == null) return null;
  return ((current - previous) / previous) * 100;
}

function DailySales() {
  const [date, setDate] = useState(todayISO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState(null);           // current day
  const [prevWeekData, setPrevWeekData] = useState(null); // same day last week

  async function fetchDaily() {
    setLoading(true);
    setError("");
    setData(null);
    setPrevWeekData(null);

    try {
      // current day
      const currentUrl = new URL("/api/sales", API_BASE_URL);
      currentUrl.searchParams.set("date", date);

      const currentRes = await fetch(currentUrl.toString(), {
        headers: { "Content-Type": "application/json" },
      });
      if (!currentRes.ok) {
        const body = await currentRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch daily sales");
      }
      const currentJson = await currentRes.json();
      setData(currentJson);

      // same weekday last week = date - 7 days
      const d = new Date(date);
      d.setDate(d.getDate() - 7);
      const lastWeekISO = d.toISOString().slice(0, 10);

      const prevUrl = new URL("/api/sales", API_BASE_URL);
      prevUrl.searchParams.set("date", lastWeekISO);

      const prevRes = await fetch(prevUrl.toString(), {
        headers: { "Content-Type": "application/json" },
      });

      if (prevRes.ok) {
        const prevJson = await prevRes.json();
        setPrevWeekData(prevJson);
      } else {
        // don't hard-fail if last week is missing
        setPrevWeekData(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error loading daily sales");
      setData(null);
      setPrevWeekData(null);
    } finally {
      setLoading(false);
    }
  }

  const locations = data?.locations || [];
  const avgOrderChain =
    data && data.grandTotal && data.grandCount
      ? data.grandTotal / data.grandCount
      : null;

  const prevTotal = prevWeekData?.grandTotal ?? null;
  const prevDateLabel = prevWeekData?.date ?? null;

  const pct = data?.grandTotal != null && prevTotal != null
    ? percentChange(data.grandTotal, prevTotal)
    : null;

  const isUp = pct != null && pct >= 0;

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
          {loading ? "Loading…" : "Load daily sales"}
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
            {/* Date */}
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

            {/* Total sales */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #14532d",
                background: "rgba(22,163,74,0.12)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Total sales
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {data.grandTotalFormatted}
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
                {data.grandCount ?? "-"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Avg ticket: {formatCurrency(avgOrderChain)}
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
                {data.locationsCount}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                With at least 1 payment
              </div>
            </div>

            {/* Comparison vs same day last week */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #4b5563",
                background: "rgba(75,85,99,0.16)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Vs same day last week
              </div>
              {prevTotal == null ? (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  No data for last week&apos;s same day.
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
                    {formatCurrency(prevTotal)} on {prevDateLabel}
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
                      {Math.abs(pct).toFixed(1)}% vs last week
                    </div>
                  )}
                </>
              )}
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
              Per-location daily performance
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
                        <div style={{ fontWeight: 600 }}>{loc.count}</div>
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

export default DailySales;
