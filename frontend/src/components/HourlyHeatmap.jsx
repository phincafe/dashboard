import React, { useState } from 'react'
import { API_BASE_URL } from '../App'

const todayISO = new Date().toISOString().slice(0, 10)

function buildHourLabel(h) {
  const suffix = h < 12 ? 'AM' : 'PM'
  const hour12 = ((h + 11) % 12) + 1
  return `${hour12}:00 ${suffix}`
}

function HourlyHeatmap() {
  const [date, setDate] = useState(todayISO)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  async function fetchHourly() {
    setLoading(true)
    setError('')
    try {
      const url = new URL('/api/sales/hourly', API_BASE_URL)
      url.searchParams.set('date', date)
      url.searchParams.set('comparePrev', 'true')

      const res = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'x-passcode': '7238',
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch hourly sales')
      }

      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message || 'Error loading hourly sales')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const hourly = data?.hourly || []
  const max = data?.maxHourAllLocations || 0

  function cellBackground(v) {
    if (!max || !v) return 'transparent'
    const ratio = Math.min(1, v / max)
    const lightness = 10 + Math.round(40 * ratio)
    return `rgba(34,197,94,${0.15 + 0.7 * ratio})`
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <label style={{ fontSize: 14 }}>
          Date:&nbsp;
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: '#020617',
              color: '#e5e7eb',
              borderRadius: 6,
              border: '1px solid #374151',
              padding: '6px 8px',
              fontSize: 13,
            }}
          />
        </label>
        <button
          onClick={fetchHourly}
          disabled={loading}
          style={{
            padding: '8px 16px',
            borderRadius: 999,
            border: 'none',
            background: '#38bdf8',
            color: '#0f172a',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Loading…' : 'Load hourly heatmap'}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 8,
            borderRadius: 8,
            background: 'rgba(220,38,38,0.2)',
            border: '1px solid rgba(220,38,38,0.6)',
            color: '#fecaca',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {data && (
        <div style={{ fontSize: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Date</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{data.date}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                Total all locations
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                ${data.totalAllLocations?.toFixed(2)}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>
            Sales by hour (all locations)
          </div>

          <div
            style={{
              overflowX: 'auto',
              borderRadius: 10,
              border: '1px solid #111827',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      'linear-gradient(to right, #020617, #020617, #020617)',
                  }}
                >
                  <th
                    style={{
                      textAlign: 'left',
                      padding: 8,
                      borderBottom: '1px solid #111827',
                    }}
                  >
                    Hour
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: 8,
                      borderBottom: '1px solid #111827',
                    }}
                  >
                    Total
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: 8,
                      borderBottom: '1px solid #111827',
                    }}
                  >
                    Orders
                  </th>
                </tr>
              </thead>
              <tbody>
                {hourly.map((bucket, idx) => (
                  <tr key={idx}>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #0b1120',
                      }}
                    >
                      {buildHourLabel(bucket.hour)}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #0b1120',
                        textAlign: 'right',
                        background: cellBackground(bucket.totalAllLocations),
                      }}
                    >
                      ${bucket.totalAllLocations.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #0b1120',
                        textAlign: 'right',
                        color: '#9ca3af',
                      }}
                    >
                      {bucket.countAllLocations}
                    </td>
                  </tr>
                ))}
                {hourly.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: 8,
                        textAlign: 'center',
                        color: '#6b7280',
                      }}
                    >
                      No hourly data returned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default HourlyHeatmap
