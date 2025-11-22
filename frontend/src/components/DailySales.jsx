import React, { useState } from 'react'
import { API_BASE_URL } from '../App'

const todayISO = new Date().toISOString().slice(0, 10)

function DailySales() {
  const [date, setDate] = useState(todayISO)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  async function fetchDaily() {
    setLoading(true)
    setError('')
    try {
      const url = new URL('/api/sales', API_BASE_URL)
      url.searchParams.set('date', date)

      const res = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          // If you use BASIC_AUTH_PASSCODE in backend, uncomment and fill:
          // 'x-passcode': 'mysecret',
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch daily sales')
      }

      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message || 'Error loading daily sales')
      setData(null)
    } finally {
      setLoading(false)
    }
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
          onClick={fetchDaily}
          disabled={loading}
          style={{
            padding: '8px 16px',
            borderRadius: 999,
            border: 'none',
            background: '#22c55e',
            color: '#052e16',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Loading…' : 'Load daily sales'}
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
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Total sales</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                ${data.total?.toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Orders</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {data.orderCount ?? '-'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>
            Locations
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
                    Location
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: 8,
                      borderBottom: '1px solid #111827',
                    }}
                  >
                    ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data.locations || []).map((loc) => (
                  <tr key={loc.id}>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #0b1120',
                      }}
                    >
                      {loc.name}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #0b1120',
                        textAlign: 'right',
                        fontFamily: 'monospace',
                      }}
                    >
                      {loc.id}
                    </td>
                  </tr>
                ))}
                {(!data.locations || data.locations.length === 0) && (
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        padding: 8,
                        textAlign: 'center',
                        color: '#6b7280',
                      }}
                    >
                      No locations returned from Square.
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

export default DailySales
