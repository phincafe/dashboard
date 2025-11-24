// frontend/src/components/DailyRefunds.jsx
import React, { useState } from "react";
import { API_BASE_URL } from "../App";

const today = new Date();
const todayISO = today.toISOString().slice(0, 10); // YYYY-MM-DD
const thisMonth = todayISO.slice(0, 7); // YYYY-MM
const thisYear = String(today.getFullYear());

function formatCurrency(v) {
  if (v == null || Number.isNaN(v)) return "-";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

/**
 * Shared generic refunds view.
 * It calls different endpoints depending on props:
 *  - endpoint: "/api/refunds/daily" | "/api/refunds/weekly" | ...
 *  - paramName: "date" | "week" | "month" | "year"
 *  - inputType: "date" | "month" | "number"
 */
function RefundsView({
  mode,
  endpoint,
  paramName,
  inputType,
  label,
  initialValue,
}) {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  async function fetchRefunds() {
    setLoading(true);
    setError("");
    try {
      const url = new URL(endpoint, API_BASE_URL);
      if (value) {
        url.searchParams.set(paramName, value);
      }

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          // If you use BASIC_AUTH on backend, set passcode here:
          // "x-passcode": "your-passcode-here",
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch refunds");
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || "Error loading refunds");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const locations = data?.locations || [];
  const grandTotalRefunded = data?.grandTotalRefunded ?? null;
  const grandTotalRefundedFormatted =
    data?.grandTotalRefundedFormatted ?? formatCurrency(grandTotalRefunded);
  const grandCount = data?.grandCount ?? null;
  const avgRefund =
    grandTotalRefunded && grandCount ? grandTotalRefunded / grandCount : null;

  // Build a label for the period (date / range / year)
  let periodLabel = "Selected period";
  if (data?.date) {
    periodLabel = data.date;
  } else if (data?.range?.start && data?.range?.end) {
    periodLabel = `${data.range.start} → ${data.range.end}`;
  } else if (data?.year) {
    periodLabel = String(data.year);
  }

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
          {label}:&nbsp;
          <input
            type={inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              background: "#020617",
              color: "#e5e7eb",
              borderRadius: 6,
              border: "1px solid #374151",
              padding: "6px 8px",
              fontSize: 13,
            }}
            min={inputType === "number" ? "2000" : undefined}
            max={inputType === "number" ? "2100" : undefined}
          />
        </label>
        <button
          onClick={fetchRefunds}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            border: "none",
            background: "#f97316",
            color: "#111827",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading…" : "Load refunds"}
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
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                {mode === "daily"
                  ? "Date"
                  : mode === "weekly"
                  ? "Week range"
                  : mode === "monthly"
                  ? "Month range"
                  : "Year"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{periodLabel}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                TZ: {data.timezone || "America/Los_Angeles"}
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #b45309",
                background: "rgba(245,158,11,0.12)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Total refunded
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {grandTotalRefundedFormatted}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Across all locations
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #7c2d12",
                background: "rgba(248,113,113,0.12)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Refund count
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {grandCount ?? "-"}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                Avg refund: {formatCurrency(avgRefund)}
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #4b5563",
                background: "rgba(31,41,55,0.7)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Locations</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {locations.length}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                With at least 1 refund
              </div>
            </div>
          </div>

          {/* Locations breakdown */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 13,
                color: "#9ca3af",
                marginBottom: 6,
              }}
            >
              Per-location refunds
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 10,
              }}
            >
              {locations.map((loc) => {
                const avgLoc =
                  loc.totalRefunded && loc.count
                    ? loc.totalRefunded / loc.count
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
                        <div style={{ color: "#9ca3af" }}>Refunded</div>
                        <div style={{ fontWeight: 600 }}>
                          {loc.totalRefundedFormatted ||
                            formatCurrency(loc.totalRefunded)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af" }}>Refunds</div>
                        <div style={{ fontWeight: 600 }}>
                          {loc.count ?? "-"}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#9ca3af" }}>Avg refund</div>
                        <div style={{ fontWeight: 600 }}>
                          {formatCurrency(avgLoc)}
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
                  No refunds in this period.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Main Refunds dashboard component used in the "Refunds" tab.
 * It provides inner tabs: Daily / Weekly / Monthly / Yearly
 */
function DailyRefunds() {
  const [mode, setMode] = useState("daily");

  const innerTabs = [
    { id: "daily", label: "Daily" },
    { id: "weekly", label: "Weekly" },
    { id: "monthly", label: "Monthly" },
    { id: "yearly", label: "Yearly" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Inner tab nav for refunds */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        {innerTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            style={{
              borderRadius: 999,
              padding: "6px 14px",
              border: "1px solid #374151",
              background:
                mode === t.id ? "rgba(248,113,113,0.2)" : "rgba(15,23,42,0.6)",
              color: mode === t.id ? "#fecaca" : "#d1d5db",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Active view */}
      {mode === "daily" && (
        <RefundsView
          mode="daily"
          endpoint="/api/refunds/daily"
          paramName="date"
          inputType="date"
          label="Date"
          initialValue={todayISO}
        />
      )}

      {mode === "weekly" && (
        <RefundsView
          mode="weekly"
          endpoint="/api/refunds/weekly"
          paramName="week"
          inputType="date"
          label="Any date in week"
          initialValue={todayISO}
        />
      )}

      {mode === "monthly" && (
        <RefundsView
          mode="monthly"
          endpoint="/api/refunds/monthly"
          paramName="month"
          inputType="month"
          label="Month"
          initialValue={thisMonth}
        />
      )}

      {mode === "yearly" && (
        <RefundsView
          mode="yearly"
          endpoint="/api/refunds/yearly"
          paramName="year"
          inputType="number"
          label="Year"
          initialValue={thisYear}
        />
      )}
    </div>
  );
}

export default DailyRefunds;
