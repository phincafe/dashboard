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

function DailySales() {
  const [date, setDate] = useState(todayISO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiInsight, setAiInsight] = useState("");

  async function fetchDaily() {
    setLoading(true);
    setError("");
    setAiInsight("");
    setAiError("");

    try {
      const url = new URL("/api/sales", API_BASE_URL);
      url.searchParams.set("date", date);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          // If you're using BASIC_AUTH_PASSCODE, uncomment:
          // "x-passcode": "yourpasscode",
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch daily sales");
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || "Error loading daily sales");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAiInsight() {
    if (!data) return;
    setAiLoading(true);
    setAiError("");
    setAiInsight("");

    try {
      const url = new URL("/api/sales/insights/daily", API_BASE_URL);
      url.searchParams.set("date", date);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          // "x-passcode": "yourpasscode",
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch AI insights");
      }

      const json = await res.json();
      setAiInsight(json.insights || "");
    } catch (err) {
      setAiError(err.message || "Error getting AI insight");
    } finally {
      setAiLoading(false);
    }
  }

  const locations = data?.locations || [];
  const numLocations = locations.length || 0;
  const avgOrderValue =
    data && data.total && data.orderCount
      ? data.total / data.orderCount
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
        <button
          onClick={fetchAiInsight}
          disabled={!data || aiLoading}
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid #4c1d95",
            background: "rgba(76,29,149,0.3)",
            color: "#e5e7eb",
            fontWeight: 500,
            cursor: data ? "pointer" : "not-allowed",
            fontSize: 14,
            opacity: !data || aiLoading ? 0.6 : 1,
          }}
        >
          {aiLoading ? "Thinking…" : "AI analysis"}
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
      {aiError && (
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
          {aiError}
        </div>
      )}

      {/* Summary + AI insight */}
      {data && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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
                Timezone: {data.timezone}
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
                {formatCurrency(data.total)}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Gross across all locations
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
                {data.orderCount ?? "-"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Avg value: {formatCurrency(avgOrderValue)} / order
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
                {numLocations}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Active Square locations in this seller account
              </div>
            </div>
          </div>

          {aiInsight && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #1f2937",
                background: "rgba(15,23,42,0.9)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: 0.12,
                  marginBottom: 4,
                }}
              >
                AI analysis
              </div>
              <div>{aiInsight}</div>
            </div>
          )}

          {/* Locations list */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 13,
                color: "#9ca3af",
                marginBottom: 6,
              }}
            >
              Locations ({numLocations})
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {locations.map((loc) => (
                <div
                  key={loc.id}
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
                      {loc.name}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid #1f2937",
                        background:
                          loc.status === "ACTIVE"
                            ? "rgba(34,197,94,0.12)"
                            : "rgba(148,163,184,0.12)",
                        color:
                          loc.status === "ACTIVE" ? "#bbf7d0" : "#e5e7eb",
                      }}
                    >
                      {loc.status}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      marginTop: 4,
                    }}
                  >
                    {loc.address?.addressLine1}
                    {", "}
                    {loc.address?.locality}, {loc.address?.administrativeDistrictLevel1}{" "}
                    {loc.address?.postalCode}
                  </div>
                  {loc.phoneNumber && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#9ca3af",
                        marginTop: 4,
                      }}
                    >
                      📞 {loc.phoneNumber}
                    </div>
                  )}
                  {loc.description && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#e5e7eb",
                        marginTop: 6,
                      }}
                    >
                      {loc.description}
                    </div>
                  )}
                </div>
              ))}

              {locations.length === 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  No locations returned from Square.
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
