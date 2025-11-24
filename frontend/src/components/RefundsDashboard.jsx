import React, { useState } from "react";
import DailyRefunds from "./DailyRefunds";
import WeeklyRefunds from "./WeeklyRefunds";
import MonthlyRefunds from "./MonthlyRefunds";
import YearlyRefunds from "./YearlyRefunds";

const REFUND_VIEWS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

function RefundsDashboard() {
  const [activeView, setActiveView] = useState("daily");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mini-tabs for refund views */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        {REFUND_VIEWS.map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            style={{
              borderRadius: 999,
              padding: "6px 14px",
              border: "1px solid #4b5563",
              background:
                activeView === view.id ? "#111827" : "rgba(15,23,42,0.6)",
              color: activeView === view.id ? "#fef3c7" : "#e5e7eb",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Active refund view */}
      <div
        style={{
          borderRadius: 12,
          border: "1px solid #1f2937",
          padding: 12,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.9))",
        }}
      >
        {activeView === "daily" && <DailyRefunds />}
        {activeView === "weekly" && <WeeklyRefunds />}
        {activeView === "monthly" && <MonthlyRefunds />}
        {activeView === "yearly" && <YearlyRefunds />}
      </div>
    </div>
  );
}

export default RefundsDashboard;
