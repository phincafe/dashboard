import React, { useState } from 'react'
import { API_BASE_URL } from '../App'

const todayISO = new Date().toISOString().slice(0, 10)

function ItemSales() {
  const [date, setDate] = useState(todayISO)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [insights, setInsights] = useState('')

  async function fetchItems() {
    setLoading(true)
    setError('')
    try {
      const url = new URL('/api/items/daily', API_BASE_URL)
      url.searchParams.set('date', date)

      const res = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'x-passcode': '7238',
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch item sales')
      }

      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message || 'Error loading item sales')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  async function fetchInsights() {
    setError('')
    setInsights('')
    try {
      const url = new URL('/api/items/insights/daily', API_BASE_URL)
      url.searchParams.set('date', date)

      const res = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          // 'x-passcode': 'mysecret',
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch item insights')
      }

      const json = await res.json()
      setInsights(json.insights || '')
    } catch (err) {
      setError(err.message || 'Error loading insights')
    }
  }

  const items = data?.items || []

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
          onClick={fetchItems}
          disabled={loading}
          style={{
            padding: '8px 16px',
            borderRadius: 999,
            border: 'none',
            background: '#a855f7',
            color: '#f9fafb',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Loading…' : 'Load item sales'}
        </button>
        <button
          onClick={fetchInsights}
          style={{
            padding: '8px 16px',
            borderRadius: 999,
            border: '1px solid #4c1d95',
            background: 'rgba(76,29,149,0.3)',
            color: '#e5e7eb',
            fontWeight: 500,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          AI Insights
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

      {insights && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: 'rgba(15,23,42,0.8)',
            border: '1px solid #1f2937',
            fontSize: 13,
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: '#9ca3af',
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.08,
            }}
          >
            AI insights
          </div>
          <div>{insights}</div>
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
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Total revenue</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                ${data.totalAmount?.toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Total items</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {data.totalQuantity ?? '-'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>
            Items
          </div>

          <div
            style={{
              maxHeight: 380,
              overflow: 'auto',
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
                      position: 'sticky',
                      top: 0,
                      background: '#020617',
                    }}
                  >
                    Item
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: 8,
                      borderBottom: '1px solid #111827',
                      position: 'sticky',
                      top: 0,
                      background: '#020617',
                    }}
                  >
                    Qty
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: 8,
                      borderBottom: '1px solid #111827',
                      position: 'sticky',
                      top: 0,
                      background: '#020617',
                    }}
                  >
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.itemId}>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #0b1120',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{item.itemName}</div>
                      {item.itemVariationName && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#9ca3af',
                          }}
                        >
                          {item.itemVariationName}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #0b1120',
                        textAlign: 'right',
                      }}
                    >
                      {item.quantity}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: '1px solid #0b1120',
                        textAlign: 'right',
                        fontFamily: 'monospace',
                      }}
                    >
                      ${item.amount?.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: 8,
                        textAlign: 'center',
                        color: '#6b7280',
                      }}
                    >
                      No items returned.
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

export default ItemSales
