// ItemSalesExplorer.jsx
import React, { useState, useMemo } from "react";
import { API_BASE_URL } from "../App";

const todayISO = new Date().toISOString().slice(0, 10);
const thisMonthISO = todayISO.slice(0, 7);
const thisYear = new Date().getFullYear();

function formatPercentChange(current, prev) {
  if (prev === 0 || prev == null) return "–";
  const diff = ((current - prev) / prev) * 100;
  const rounded = Math.round(diff * 10) / 10;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

function ItemSalesExplorer() {
  const [timeframe, setTimeframe] = useState("daily"); // daily | weekly | monthly | yearly
  const [date, setDate] = useState(todayISO);
  const [weekDate, setWeekDate] = useState(todayISO);
  const [month, setMonth] = useState(thisMonthISO);
  const [year, setYear] = useState(String(thisYear));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null); // current period
  const [comparison, setComparison] = useState(null); // optional previous period

  const [locationFilter, setLocationFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("revenue"); // 'revenue' | 'quantity'

  async function fetchData() {
    setLoading(true);
    setError("");
    setData(null);
    setComparison(null);

    try {
      let url;
      const base = new URL("/api/items/sales", API_BASE_URL);

      // 🔧 Adjust this logic if your backend uses different paths.
      // Here we assume:
      //  GET /api/items/sales/daily?date=YYYY-MM-DD
      //  GET /api/items/sales/weekly?week=YYYY-MM-DD
      //  GET /api/items/sales/monthly?month=YYYY-MM
      //  GET /api/items/sales/yearly?year=YYYY
      switch (timeframe) {
        case "daily":
          url = new URL("/api/items/sales/daily", API_BASE_URL);
          url.searchParams.set("date", date);
          break;
        case "weekly":
          url = new URL("/api/items/sales/weekly", API_BASE_URL);
          url.searchParams.set("week", weekDate);
          break;
        case "monthly":
          url = new URL("/api/items/sales/monthly", API_BASE_URL);
          url.searchParams.set("month", month);
          break;
        case "yearly":
          url = new URL("/api/items/sales/yearly", API_BASE_URL);
          url.searchParams.set("year", year);
          break;
        default:
          url = base;
      }

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

      // support shape: { ...fields, comparison: { ... } } OR no comparison
      setData(json);
      if (json.comparison) {
        setComparison(json.comparison);
      } else {
        setComparison(null);
      }
    } catch (err) {
      setError(err.message || "Error loading item sales");
    } finally {
      setLoading(false);
    }
  }

  const locations = data?.locations || [];
  const overallItems = data?.overallItems || [];
  const grandTotal = data?.grandTotal || 0;
  const grandTotalFormatted = data?.grandTotalFormatted || "$0.00";

  // Compute totals for comparison if provided
  const comparisonGrandTotal = comparison?.grandTotal ?? null;

  const currentLocationOptions = useMemo(() => {
    const opts = [{ value: "ALL", label: "All locations" }];
    for (const loc of locations) {
      opts.push({
        value: loc.locationId,
        label: loc.locationName,
      });
    }
    return opts;
  }, [locations]);

  const itemsForView = useMemo(() => {
    if (!data) return [];

    if (locationFilter === "ALL") {
      return overallItems;
    }

    const loc = locations.find((l) => l.locationId === locationFilter);
    if (!loc) return [];

    return loc.items || [];
  }, [data, overallItems, locations, locationFilter]);

  const filteredAndSortedItems = useMemo(() => {
    let list = itemsForView;
    if (!list || list.length === 0) return [];

    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((item) =>
        (item.itemName || "Unnamed").toLowerCase().includes(s)
      );
    }

    const copy = [...list];
    copy.sort((a, b) => {
      if (sortBy === "quantity") {
        return (b.quantity || 0) - (a.quantity || 0);
      }
      // revenue
      return (b.total || 0) - (a.total || 0);
    });

    return copy;
  }, [itemsForView, search, sortBy]);

  const totalItemsSold = useMemo(() => {
    if (!overallItems || overallItems.length === 0) return 0;
    return overallItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
  }, [overallItems]);

  const distinctItems = useMemo(
    () => (overallItems ? overallItems.length : 0),
    [overallItems]
  );

  function renderPeriodLabel() {
    if (!data) return "";
    switch (data.type) {
      case "daily":
        return data.date;
      case "weekly":
        if (data.range) {
          return `${data.range.start} → ${data.range.end}`;
        }
        return "Weekly range";
      case "monthly":
        if (data.range) {
          return `${data.range.start} → ${data.range.end}`;
        }
        return data.month || "Monthly";
      case "yearly":
        if (data.range) {
          return `${data.range.start} → ${data.range.end}`;
        }
        return data.year || "Yearly";
      default:
        return "";
    }
  }

  function shareOfTotal(amount) {
    if (!grandTotal) return "–";
    const pct = (amount / grandTotal) * 100;
    const rounded = Math.round(pct * 10) / 10;
    return `${rounded}%`;
  }

  const isDaily = timeframe === "daily";
  const isWeekly = timeframe === "weekly";
  const isMonthly = timeframe === "monthly";
  const isYearly = timeframe === "yearly";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Timeframe selector */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["daily", "weekly", "monthly", "yearly"].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "1px solid #1f2937",
                background: timeframe === tf ? "#38bdf8" : "#020617",
                color: timeframe === tf ? "#0f172a" : "#e5e7eb",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>

        {/* Period pickers */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isDaily && (
            <label style={{ fontSize: 13 }}>
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
                  padding: "4px 8px",
                  fontSize: 13,
                }}
              />
            </label>
          )}
          {isWeekly && (
            <label style={{ fontSize: 13 }}>
              Week (pick any day):&nbsp;
              <input
                type="date"
                value={weekDate}
                onChange={(e) => setWeekDate(e.target.value)}
                style={{
                  background: "#020617",
                  color: "#e5e7eb",
                  borderRadius: 6,
                  border: "1px solid #374151",
                  padding: "4px 8px",
                  fontSize: 13,
                }}
              />
            </label>
          )}
          {isMonthly && (
            <label style={{ fontSize: 13 }}>
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
                  padding: "4px 8px",
                  fontSize: 13,
                }}
              />
            </label>
          )}
          {isYearly && (
            <label style={{ fontSize: 13 }}>
              Year:&nbsp;
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                style={{
                  width: 80,
                  background: "#020617",
                  color: "#e5e7eb",
                  borderRadius: 6,
                  border: "1px solid #374151",
                  padding: "4px 8px",
                  fontSize: 13,
                }}
              />
            </label>
          )}
        </div>

        {/* Load button */}
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            padding: "8px 18px",
            borderRadius: 999,
            border: "none",
            background: "#38bdf8",
            color: "#0f172a",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Loading…" : "Load item sales"}
        </button>
      </div>

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

      {!data && !loading && (
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Choose a timeframe and load item sales.
        </div>
      )}

      {data && (
        <>
          {/* Header summary */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              justifyContent: "space-between",
            }}
          >
            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Period</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {data.type?.toUpperCase()} – {renderPeriodLabel()}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Timezone: {data.timezone}
              </div>
            </div>

            {/* Metric cards */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                flexGrow: 1,
                justifyContent: "flex-end",
              }}
            >
              {/* Total revenue */}
              <SummaryCard
                label="Total revenue"
                value={grandTotalFormatted}
                comparisonValue={
                  comparisonGrandTotal != null ? comparisonGrandTotal : null
                }
                comparisonLabel="vs previous period"
              />
              {/* Items sold */}
              <SummaryCard
                label="Total items sold"
                value={totalItemsSold.toLocaleString()}
              />
              {/* Distinct items */}
              <SummaryCard
                label="Distinct items"
                value={distinctItems.toString()}
              />
              {/* Locations */}
              <SummaryCard
                label="Locations"
                value={locations.length.toString()}
              />
            </div>
          </div>

          {/* Filters row: location + search + sort */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              marginTop: 12,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Location:</span>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                style={{
                  background: "#020617",
                  color: "#e5e7eb",
                  borderRadius: 999,
                  border: "1px solid #374151",
                  padding: "4px 10px",
                  fontSize: 13,
                }}
              >
                {currentLocationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Sort by:</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => setSortBy("revenue")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid #1f2937",
                    background: sortBy === "revenue" ? "#10b981" : "#020617",
                    color: sortBy === "revenue" ? "#022c22" : "#e5e7eb",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Revenue
                </button>
                <button
                  onClick={() => setSortBy("quantity")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid #1f2937",
                    background: sortBy === "quantity" ? "#10b981" : "#020617",
                    color: sortBy === "quantity" ? "#022c22" : "#e5e7eb",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Quantity
                </button>
              </div>
            </div>

            <div style={{ flexGrow: 1, minWidth: 180 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item name…"
                style={{
                  width: "100%",
                  background: "#020617",
                  color: "#e5e7eb",
                  borderRadius: 999,
                  border: "1px solid #374151",
                  padding: "6px 12px",
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          {/* Main layout: Item table + per-location summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2.5fr) minmax(0, 1.5fr)",
              gap: 16,
              marginTop: 16,
            }}
          >
            {/* Left: items table */}
            <div
              style={{
                borderRadius: 10,
                border: "1px solid #111827",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #111827",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background:
                    "linear-gradient(to right, #020617, #020617, #020617)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  Items ({filteredAndSortedItems.length})
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: 0.04,
                  }}
                >
                  {locationFilter === "ALL"
                    ? "All locations combined"
                    : currentLocationOptions.find(
                        (o) => o.value === locationFilter
                      )?.label || "Location"}
                </div>
              </div>
              <div style={{ maxHeight: 460, overflow: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          padding: 8,
                          textAlign: "left",
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
                          padding: 8,
                          textAlign: "right",
                          borderBottom: "1px solid #111827",
                          position: "sticky",
                          top: 0,
                          background: "#020617",
                        }}
                      >
                        Qty
                      </th>
                      <th
                        style={{
                          padding: 8,
                          textAlign: "right",
                          borderBottom: "1px solid #111827",
                          position: "sticky",
                          top: 0,
                          background: "#020617",
                        }}
                      >
                        Revenue
                      </th>
                      {locationFilter === "ALL" && (
                        <th
                          style={{
                            padding: 8,
                            textAlign: "right",
                            borderBottom: "1px solid #111827",
                            position: "sticky",
                            top: 0,
                            background: "#020617",
                          }}
                        >
                          Share of total
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedItems.map((item, idx) => {
                      const name = item.itemName || "Unnamed item";
                      const total = item.total || 0;
                      const totalFmt = item.totalFormatted || `$${total.toFixed(2)}`;

                      // For bar background (relative revenue within current view)
                      const maxRevenue =
                        filteredAndSortedItems[0]?.total || 0 || 1;
                      const ratio = Math.min(1, total / maxRevenue);

                      return (
                        <tr
                          key={`${item.catalogObjectId || name}-${idx}`}
                          style={{
                            borderBottom: "1px solid #020617",
                            background:
                              idx % 2 === 0 ? "#020617" : "#030712",
                          }}
                        >
                          <td
                            style={{
                              padding: "6px 8px",
                              fontSize: 12,
                              maxWidth: 260,
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={name}
                            >
                              {name}
                            </div>
                            {item.catalogObjectId && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "#6b7280",
                                  marginTop: 2,
                                }}
                              >
                                {item.catalogObjectId}
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              textAlign: "right",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.quantity?.toLocaleString?.() ??
                              item.quantity ??
                              0}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              textAlign: "right",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <div
                              style={{
                                position: "relative",
                                display: "inline-block",
                                minWidth: 80,
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  borderRadius: 999,
                                  opacity: 0.25,
                                  background:
                                    "linear-gradient(to right, #22c55e, #a3e635)",
                                  transformOrigin: "left",
                                  transform: `scaleX(${ratio || 0.02})`,
                                }}
                              />
                              <div
                                style={{
                                  position: "relative",
                                  padding: "0 6px",
                                }}
                              >
                                {totalFmt}
                              </div>
                            </div>
                          </td>
                          {locationFilter === "ALL" && (
                            <td
                              style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                whiteSpace: "nowrap",
                                fontSize: 11,
                                color: "#9ca3af",
                              }}
                            >
                              {shareOfTotal(total)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {filteredAndSortedItems.length === 0 && (
                      <tr>
                        <td
                          colSpan={locationFilter === "ALL" ? 4 : 3}
                          style={{
                            padding: 10,
                            textAlign: "center",
                            color: "#6b7280",
                          }}
                        >
                          No items found for this selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: per-location summary */}
            <div
              style={{
                borderRadius: 10,
                border: "1px solid #111827",
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Locations overview
              </div>

              {locations.length === 0 && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  No location data.
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 460,
                  overflow: "auto",
                }}
              >
                {locations.map((loc) => {
                  const share = shareOfTotal(loc.total || 0);

                  return (
                    <div
                      key={loc.locationId}
                      style={{
                        borderRadius: 10,
                        padding: 8,
                        border: "1px solid #1f2937",
                        background:
                          locationFilter === loc.locationId
                            ? "rgba(56,189,248,0.08)"
                            : "#020617",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              marginBottom: 2,
                            }}
                          >
                            {loc.locationName}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#9ca3af",
                            }}
                          >
                            {loc.totalFormatted} · {share} of total
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setLocationFilter((prev) =>
                              prev === loc.locationId ? "ALL" : loc.locationId
                            )
                          }
                          style={{
                            fontSize: 11,
                            borderRadius: 999,
                            border: "1px solid #1f2937",
                            background:
                              locationFilter === loc.locationId
                                ? "#38bdf8"
                                : "#020617",
                            color:
                              locationFilter === loc.locationId
                                ? "#0f172a"
                                : "#e5e7eb",
                            padding: "4px 10px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {locationFilter === loc.locationId
                            ? "Show all"
                            : "Focus"}
                        </button>
                      </div>

                      {/* Top 3 items in that location */}
                      <div style={{ marginTop: 6 }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#9ca3af",
                            marginBottom: 2,
                          }}
                        >
                          Top items
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          {(loc.items || [])
                            .slice(0, 3)
                            .map((it, idx2) => (
                              <div
                                key={idx2}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  fontSize: 11,
                                }}
                              >
                                <div
                                  style={{
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: 150,
                                  }}
                                  title={it.itemName}
                                >
                                  {idx2 + 1}. {it.itemName}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span style={{ color: "#9ca3af" }}>
                                    x{it.quantity}
                                  </span>
                                  <span>{it.totalFormatted}</span>
                                </div>
                              </div>
                            ))}
                          {(loc.items || []).length === 0 && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#6b7280",
                                fontStyle: "italic",
                              }}
                            >
                              No items
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, comparisonValue, comparisonLabel }) {
  let comparisonText = null;
  let comparisonPositive = null;

  if (comparisonValue != null) {
    const prev = comparisonValue;
    const numericPrev = Number(prev || 0);
    let numericCurrent;

    // try to parse value if it's $string
    if (typeof value === "string" && value.startsWith("$")) {
      numericCurrent = Number(
        value.replace("$", "").replace(/,/g, "") || "0"
      );
    } else {
      numericCurrent = Number(value || 0);
    }

    if (!isNaN(numericCurrent) && !isNaN(numericPrev) && numericPrev !== 0) {
      const diffPct = ((numericCurrent - numericPrev) / numericPrev) * 100;
      const rounded = Math.round(diffPct * 10) / 10;
      comparisonPositive = diffPct >= 0;
      const sign = diffPct > 0 ? "+" : "";
      comparisonText = `${sign}${rounded}%`;
    }
  }

  return (
    <div
      style={{
        minWidth: 140,
        borderRadius: 12,
        border: "1px solid #111827",
        padding: "8px 10px",
        background: "#020617",
      }}
    >
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
      {comparisonText && comparisonLabel && (
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: comparisonPositive ? "#4ade80" : "#f87171",
          }}
        >
          {comparisonText}{" "}
          <span style={{ color: "#9ca3af" }}>{comparisonLabel}</span>
        </div>
      )}
    </div>
  );
}

export default ItemSalesExplorer;
