// frontend/src/components/MonthlySales.jsx
import React, { useState } from "react";
import { API_BASE_URL } from "../App";

const current = new Date();
const defaultMonth = `${current.getFullYear()}-${String(
  current.getMonth() + 1
).padStart(2, "0")}`; // YYYY-MM

function formatCurrency(v) {
  if (v == null || Number.isNaN(v)) return "-";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function MonthlySales() {
  const [month, setMonth] = useState(defaultMonth); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  async function fetchMonthly() {
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/sales/monthly", API_BASE_URL);
      url.searchParams.set("month", month);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          // "x-passcode": "your-passcode-here",
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch monthly sales");
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || "Error loading monthly sales");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const locations = data?.locations || [];
  const avgOrderChain =
    data && data.grandTotal && data.grandCount
      ? data.grandTotal / data.grandCount
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
          {/* Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
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
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Range</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {data.range?.start} → {data.range?.end}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Type: {data.type}
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
                All locations this month
              </div>
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
          </div>

          {/* Locations */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 13,
                color: "#9ca3af",
                marginBottom: 6,
              }}
            >
              Monthly totals by location
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
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#e5e7eb",
                      }}
                    >
                      {loc.locationName}
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

export default MonthlySales;
