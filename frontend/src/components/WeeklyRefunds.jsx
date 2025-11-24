// frontend/src/components/WeeklyRefunds.jsx
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

function WeeklyRefunds() {
  const [weekDate, setWeekDate] = useState(todayISO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  async function fetchWeeklyRefunds() {
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/refunds/weekly", API_BASE_URL);
      url.searchParams.set("week", weekDate);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch weekly refunds");
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || "Error loading weekly refunds");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const locations = data?.locations || [];
  const range = data?.range;

  // ⬇️ NEW: Support both naming schemes (old + new)
  const grandTotal =
    data?.grandTotal ??
    data?.grandRefundTotal ??
    null;

  const grandTotalFormatted =
    data?.grandTotalFormatted ||
    data?.grandRefundTotalFormatted ||
    formatCurrency(grandTotal);

  const grandCount =
    data?.grandCount ??
    data?.grandRefundCount ??
    null;

  const rangeLabel =
    range?.start && range?.end
      ? `${range.start} → ${range.end}`
      : "No range";

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
          Week of (pick any date in week):&nbsp;
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
          onClick={fetchWeeklyRefunds}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            border: "none",
            background: "#f97316",
            color: "#0b1120",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading…" : "Load weekly refunds"}
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
            {/* Week Range */}
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
              <div style={{ fontSize: 16, fontWeight: 600 }}>{rangeLabel}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                TZ: {data.timezone}
              </div>
            </div>

            {/* Total refunded */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #b45309",
                background: "rgba(234,88,12,0.12)",
              }}
            >
              <div style={{ fontSize: 12, color: "#fed7aa" }}>
                Total refunded
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fed7aa" }}>
                {grandTotalFormatted}
              </div>
              <div style={{ fontSize: 11, color: "#fdba74", marginTop: 4 }}>
                Sum of all refunds in this week
              </div>
            </div>

            {/* Refund count */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #c2410c",
                background: "rgba(248,113,113,0.08)",
              }}
            >
              <div style={{ fontSize: 12, color: "#fecaca" }}>
                Refund count
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fecaca" }}>
                {grandCount ?? "-"}
              </div>
              <div style={{ fontSize: 11, color: "#fecaca", marginTop: 4 }}>
                Number of refund transactions
              </div>
            </div>

            {/* Locations count */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #4b5563",
                background: "rgba(31,41,55,0.75)",
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Locations with refunds
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e5e7eb" }}>
                {data.locationsCount}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                At least one refund recorded
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
              Per-location weekly refunds
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 10,
              }}
            >
              {locations.map((loc) => (
                <div
                  key={loc.locationId}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid #111827",
                    background:
                      "linear-gradient(135deg, #020617 0%, #111827 60%, #020617 100%)",
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
                      <div style={{ color: "#9ca3af" }}>Refund total</div>
                      <div style={{ fontWeight: 600, color: "#fecaca" }}>
                        {loc.totalFormatted || formatCurrency(loc.total)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#9ca3af" }}>Refund count</div>
                      <div style={{ fontWeight: 600, color: "#e5e7eb" }}>
                        {loc.count}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {locations.length === 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  No refunds found for this week.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default WeeklyRefunds;
