// frontend/src/components/YearlySales.jsx
import React, { useState } from "react";
import { API_BASE_URL } from "../App";

const thisYearDefault = new Date().getFullYear().toString();

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

function YearlySales() {
  const [year, setYear] = useState(thisYearDefault);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [currentYear, setCurrentYear] = useState(null);
  const [prevYear, setPrevYear] = useState(null);

  async function fetchYearly() {
    setLoading(true);
    setError("");
    setCurrentYear(null);
    setPrevYear(null);

    try {
      const curUrl = new URL("/api/sales/yearly", API_BASE_URL);
      curUrl.searchParams.set("year", year);

      const curRes = await fetch(curUrl.toString(), {
        headers: { "Content-Type": "application/json" },
      });
      if (!curRes.ok) {
        const body = await curRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch yearly sales");
      }
      const curJson = await curRes.json();
      setCurrentYear(curJson);

      const prevStr = (parseInt(year, 10) - 1).toString();
      const prevUrl = new URL("/api/sales/yearly", API_BASE_URL);
      prevUrl.searchParams.set("year", prevStr);

      const prevRes = await fetch(prevUrl.toString(), {
        headers: { "Content-Type": "application/json" },
      });
      if (prevRes.ok) {
        const prevJson = await prevRes.json();
        setPrevYear(prevJson);
      } else {
        setPrevYear(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error loading yearly sales");
      setCurrentYear(null);
      setPrevYear(null);
    } finally {
      setLoading(false);
    }
  }

  const months = currentYear?.months || []; // assuming backend returns months[]

  const prevTotal = prevYear?.grandTotal ?? null;
  const pct =
    currentYear?.grandTotal != null && prevTotal != null
      ? percentChange(currentYear.grandTotal, prevTotal)
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
          Year:&nbsp;
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{
              background: "#020617",
              color: "#e5e7eb",
              borderRadius: 6,
              border: "1px solid #374151",
              padding: "6px 8px",
              fontSize: 13,
              width: 100,
            }}
          />
        </label>
        <button
          onClick={fetchYearly}
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
          {loading ? "Loading…" : "Load yearly sales"}
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
      {currentYear && (
        <>
          {/* Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {/* Year card */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #1f2937",
                background:
                  "radial-gradient(circle at top, #0f172a, #020617 70%)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Year</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {currentYear.year ?? year}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                TZ: {currentYear.timezone}
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
                {currentYear.grandTotalFormatted}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Across all locations
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
                Vs previous year
              </div>
              {prevTotal == null ? (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  No data for previous year.
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
                    {formatCurrency(prevTotal)} in{" "}
                    {prevYear.year ?? (parseInt(year, 10) - 1)}
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
                      {Math.abs(pct).toFixed(1)}% vs previous year
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Month table */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 13,
                color: "#9ca3af",
                marginBottom: 6,
              }}
            >
              Month-by-month breakdown
            </div>

            {months.length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                }}
              >
                No monthly data available.
              </div>
            ) : (
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
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "rgba(15,23,42,0.9)",
                        color: "#9ca3af",
                      }}
                    >
                      <th
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          borderBottom: "1px solid #111827",
                        }}
                      >
                        Month
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 10px",
                          borderBottom: "1px solid #111827",
                        }}
                      >
                        Total
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 10px",
                          borderBottom: "1px solid #111827",
                        }}
                      >
                        Orders
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr
                        key={m.month}
                        style={{
                          borderBottom: "1px solid #020617",
                          background: "rgba(15,23,42,0.6)",
                        }}
                      >
                        <td
                          style={{
                            padding: "6px 10px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.month}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.totalFormatted ?? formatCurrency(m.total)}
                        </td>
                        <td
                          style={{
                            padding: "6px 10px",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.count ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default YearlySales;
