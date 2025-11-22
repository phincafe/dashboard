// src/components/ItemSalesExplorer.jsx
import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../App";

const todayISO = new Date().toISOString().slice(0, 10);

const PERIODS = [
  { id: "daily", label: "Daily", endpoint: "/api/items/daily", paramKey: "date" },
  { id: "weekly", label: "Weekly", endpoint: "/api/items/weekly", paramKey: "week" },
  { id: "monthly", label: "Monthly", endpoint: "/api/items/monthly", paramKey: "month" },
  { id: "yearly", label: "Yearly", endpoint: "/api/items/yearly", paramKey: "year" },
];

function formatDateLabel(data) {
  if (!data) return "";
  if (data.type === "daily") return data.date;
  if (data.type === "weekly" || data.type === "monthly") {
    return `${data.range.start} → ${data.range.end}`;
  }
  if (data.type === "yearly") {
    return `${data.year} (${data.range.start} → ${data.range.end})`;
  }
  return "";
}

function ItemSalesExplorer() {
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState(todayISO); // used for daily + weekly; monthly we use yyyy-mm
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [locationFilter, setLocationFilter] = useState("ALL");

  // Load data whenever period or date changes
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function fetchData(customDate) {
    const currentPeriod = PERIODS.find((p) => p.id === period);
    if (!currentPeriod) return;

    const rawDate = customDate || date;

   let paramValue = rawDate;

    if (period === "monthly") {
      paramValue = rawDate.slice(0, 7); // "YYYY-MM"
    } else if (period === "yearly") {
      paramValue = rawDate.slice(0, 4); // "YYYY"
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const url = new URL(currentPeriod.endpoint, API_BASE_URL);
      url.searchParams.set(currentPeriod.paramKey, paramValue);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          "x-passcode": "7238",
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load item sales");
      }

      const json = await res.json();
      setData(json);
      setLocationFilter("ALL"); // reset filter when new data loads
    } catch (err) {
      setError(err.message || "Error loading item sales");
    } finally {
      setLoading(false);
    }
  }

  // Handle date change from picker
function handleDateChange(e) {
  const val = e.target.value;

  if (period === "yearly") {
    // store as YYYY-01-01 so state is still a full date
    const safeYear = val || new Date().getFullYear().toString();
    const full = `${safeYear}-01-01`;
    setDate(full);
    fetchData(full);
  } else if (period === "monthly") {
    // browser gives YYYY-MM; convert to YYYY-MM-01 for state
    const full = `${val}-01`;
    setDate(full);
    fetchData(full);
  } else {
    setDate(val);
    fetchData(val);
  }
}


  const dateLabel = formatDateLabel(data);
  const grandTotal = data?.grandTotal || 0;
  const locations = data?.locations || [];

  // Determine which items to show based on location filter
  let tableItems = data?.overallItems || [];
  let scopeLabel = "All locations";

  if (locationFilter !== "ALL" && locations.length > 0) {
    const loc = locations.find((l) => l.locationId === locationFilter);
    if (loc) {
      tableItems = loc.items || [];
      scopeLabel = loc.locationName || loc.locationId;
    }
  }

  return (
    <div>
      {/* Top Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        {/* Period tabs inside Item Explorer */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{
                borderRadius: 999,
                padding: "6px 12px",
                border: "1px solid #374151",
                background:
                  period === p.id ? "#38bdf8" : "rgba(15,23,42,0.8)",
                color: period === p.id ? "#0f172a" : "#e5e7eb",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

       <label style={{ fontSize: 13 }}>
  {period === "monthly"
    ? "Month:"
    : period === "yearly"
    ? "Year:"
    : "Date:"}
  &nbsp;
  <input
    type={
      period === "monthly"
        ? "month"
        : period === "yearly"
        ? "number"
        : "date"
    }
    min={period === "yearly" ? "2020" : undefined}
    max={period === "yearly" ? "2100" : undefined}
    value={
      period === "monthly"
        ? (date.length >= 7 ? date.slice(0, 7) : date)
        : period === "yearly"
        ? date.slice(0, 4)
        : date
    }
    onChange={handleDateChange}
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
          onClick={() => fetchData()}
          disabled={loading}
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            border: "none",
            background: "#22c55e",
            color: "#022c22",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 13,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: 8,
            borderRadius: 8,
            background: "rgba(220,38,38,0.18)",
            border: "1px solid rgba(220,38,38,0.5)",
            color: "#fecaca",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Nothing loaded yet */}
      {!data && !loading && !error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px dashed #374151",
            fontSize: 13,
            color: "#9ca3af",
          }}
        >
          Pick a date/period and click{" "}
          <span style={{ fontWeight: 600 }}>Refresh</span> to see item sales.
        </div>
      )}

      {/* Main content */}
      {data && (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "2fr 1fr" }}>
          {/* Left side: summary + table */}
          <div>
            {/* Summary header */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {data.type === "daily"
                    ? "Day"
                    : data.type === "weekly"
                    ? "Week"
                    : "Month"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {dateLabel}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  Timezone: {data.timezone}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  Item revenue ({scopeLabel})
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {locationFilter === "ALL"
                    ? data.grandTotalFormatted
                    : locations.find((l) => l.locationId === locationFilter)
                        ?.totalFormatted || "$0.00"}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {tableItems.length} items
                </div>
              </div>
            </div>

            {/* Location filter */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 13, color: "#9ca3af" }}>
                View items for:
              </div>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                style={{
                  background: "#020617",
                  color: "#e5e7eb",
                  borderRadius: 6,
                  border: "1px solid #374151",
                  padding: "6px 8px",
                  fontSize: 13,
                  minWidth: 180,
                }}
              >
                <option value="ALL">All locations (combined)</option>
                {locations.map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>
                    {loc.locationName}
                  </option>
                ))}
              </select>
            </div>

            {/* Items table */}
            <div
              style={{
                borderRadius: 10,
                border: "1px solid #111827",
                overflow: "hidden",
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
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
                        position: "sticky",
                        top: 0,
                        background: "#020617",
                        zIndex: 1,
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: 8,
                        borderBottom: "1px solid #111827",
                        position: "sticky",
                        top: 0,
                        background: "#020617",
                        zIndex: 1,
                      }}
                    >
                      Item
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: 8,
                        borderBottom: "1px solid #111827",
                        position: "sticky",
                        top: 0,
                        background: "#020617",
                        zIndex: 1,
                      }}
                    >
                      Qty
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: 8,
                        borderBottom: "1px solid #111827",
                        position: "sticky",
                        top: 0,
                        background: "#020617",
                        zIndex: 1,
                      }}
                    >
                      Sales
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: 8,
                        borderBottom: "1px solid #111827",
                        position: "sticky",
                        top: 0,
                        background: "#020617",
                        zIndex: 1,
                      }}
                    >
                      % of total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableItems.map((item, idx) => {
                    const pct =
                      grandTotal > 0
                        ? (item.total / grandTotal) * 100
                        : 0;
                    return (
                      <tr
                        key={item.itemName + idx}
                        style={{
                          background:
                            idx % 2 === 0 ? "rgba(15,23,42,0.9)" : "rgba(15,23,42,0.7)",
                        }}
                      >
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #020617",
                            color: "#6b7280",
                            width: 40,
                          }}
                        >
                          {idx + 1}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #020617",
                          }}
                        >
                          {item.itemName}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #020617",
                            textAlign: "right",
                            color: "#e5e7eb",
                          }}
                        >
                          {item.quantity}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #020617",
                            textAlign: "right",
                          }}
                        >
                          {item.totalFormatted}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #020617",
                            textAlign: "right",
                            color: "#9ca3af",
                          }}
                        >
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                  {tableItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: 10,
                          textAlign: "center",
                          color: "#6b7280",
                        }}
                      >
                        No item data for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right side: per-location summary */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxHeight: 460,
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>
              Locations summary
            </div>
            {locations.map((loc) => (
              <div
                key={loc.locationId}
                style={{
                  borderRadius: 12,
                  border: "1px solid #1f2937",
                  padding: 10,
                  background:
                    locationFilter === loc.locationId
                      ? "rgba(56,189,248,0.12)"
                      : "rgba(15,23,42,0.9)",
                  cursor: "pointer",
                }}
                onClick={() => setLocationFilter(loc.locationId)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {loc.locationName}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {loc.totalFormatted}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    marginTop: 2,
                  }}
                >
                  Top sellers:{" "}
                  {(loc.items || [])
                    .slice(0, 3)
                    .map((i) => i.itemName)
                    .join(", ") || "—"}
                </div>
              </div>
            ))}

            {locations.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  borderRadius: 10,
                  border: "1px dashed #374151",
                  padding: 10,
                }}
              >
                No per-location breakdown returned.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ItemSalesExplorer;
