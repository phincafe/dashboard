import React, { useState } from 'react'
import DailySales from './components/DailySales'
import HourlyHeatmap from './components/HourlyHeatmap'
import ItemSales from './components/ItemSales'

const TABS = [
  { id: 'daily', label: 'Daily Sales' },
  { id: 'hourly', label: 'Hourly Heatmap' },
  { id: 'items', label: 'Item Sales' },
]

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

function App() {
  const [activeTab, setActiveTab] = useState('daily')

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Phin Cafe · Square Reports</h1>
        <p style={{ marginTop: 4, color: '#9ca3af', fontSize: 14 }}>
          React dashboard for your existing Square Daily / Hourly / Item reports.
        </p>
      </header>

      <nav
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              borderRadius: 999,
              padding: '8px 16px',
              border: '1px solid #374151',
              background:
                activeTab === tab.id ? '#111827' : 'rgba(15,23,42,0.4)',
              color: activeTab === tab.id ? '#f9fafb' : '#d1d5db',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section
        style={{
          borderRadius: 16,
          border: '1px solid #1f2937',
          padding: 16,
          background:
            'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.85))',
          boxShadow: '0 18px 45px rgba(0,0,0,0.45)',
        }}
      >
        {activeTab === 'daily' && <DailySales />}
        {activeTab === 'hourly' && <HourlyHeatmap />}
        {activeTab === 'items' && <ItemSales />}
      </section>

      <footer style={{ marginTop: 24, fontSize: 12, color: '#6b7280' }}>
        <div>Backend: {API_BASE_URL}</div>
        <div style={{ marginTop: 4 }}>
          Make sure Render frontend env has <code>VITE_API_BASE_URL</code> set
          to your backend URL.
        </div>
      </footer>
    </div>
  )
}

export default App
