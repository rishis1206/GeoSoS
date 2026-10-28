import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '../services/api'
import SOSMap from '../components/SOSMap'

export default function Home() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [radarBots, setRadarBots] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const fetchLogs = () => {
      api.get('/sos/public', { params: { _t: Date.now() } })
        .then(res => setLogs(res.data.logs || []))
        .catch(() => {})
    }
    fetchLogs()
    const timer = setInterval(fetchLogs, 5000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchBots = () => {
      api.get('/volunteers/radar-bots')
        .then(res => {
          if (res.data?.bots) setRadarBots(res.data.bots)
        })
        .catch(() => {})
    }
    fetchBots()
    const bTimer = setInterval(fetchBots, 8000)
    return () => clearInterval(bTimer)
  }, [])

  const getStatusColor = (status) => {
    if (status === 'completed') return '#00cc44'
    if (status === 'pending') return '#cc0000'
    if (status === 'accepted' || status === 'responding') return '#ffaa00'
    return '#555'
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'medical': return '🚑'
      case 'accident': return '🚗'
      case 'fire': return '🔥'
      case 'natural_disaster': return '🌊'
      case 'assault': return '🛡️'
      default: return '🚨'
    }
  }

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const filteredLogs = logs.filter(log => {
    if (filter === 'completed') return log.status === 'completed'
    if (filter === 'active') return log.status === 'pending' || log.status === 'accepted' || log.status === 'responding'
    return true
  })

  const completedCount = logs.filter(l => l.status === 'completed').length
  const activeCount = logs.filter(l => l.status === 'pending' || l.status === 'accepted' || l.status === 'responding').length

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Oswald, sans-serif' }}>

      {/* Navbar */}
      <nav className="mobile-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 48px', borderBottom: '1px solid #1c1c1c' }}>
        <div style={{ color: '#fff', fontSize: '20px', letterSpacing: '6px', fontWeight: '600', textTransform: 'uppercase' }}>
          <span style={{ color: '#cc0000' }}>&#9675;</span> Emergency SOS
        </div>
        <div className="mobile-nav-links" style={{ display: 'flex', gap: '32px' }}>
          <span style={{ color: '#fff', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer' }}>Home</span>
          <span onClick={() => navigate('/victim')} style={{ color: '#555', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer' }}>Victim</span>
          <span onClick={() => navigate('/volunteer')} style={{ color: '#555', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer' }}>Volunteer</span>
        </div>
      </nav>

      {/* Red bar */}
      <div style={{ height: '2px', background: 'linear-gradient(90deg, #0a0a0a, #cc0000, #0a0a0a)' }} />

      {/* Hero */}
      <div className="mobile-p-20" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 36px 64px', textAlign: 'center', borderBottom: '1px solid #1c1c1c' }}>
        <div style={{ position: 'absolute', top: '20px', left: '20px', width: '20px', height: '20px', borderTop: '2px solid #cc0000', borderLeft: '2px solid #cc0000' }} />
        <div style={{ position: 'absolute', top: '20px', right: '20px', width: '20px', height: '20px', borderTop: '2px solid #cc0000', borderRight: '2px solid #cc0000' }} />
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', width: '20px', height: '20px', borderBottom: '2px solid #cc0000', borderLeft: '2px solid #cc0000' }} />
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '20px', height: '20px', borderBottom: '2px solid #cc0000', borderRight: '2px solid #cc0000' }} />

        <div style={{ fontSize: '11px', letterSpacing: '6px', color: '#cc0000', textTransform: 'uppercase', marginBottom: '20px' }}>
          AI Powered Emergency Response Platform
        </div>
        <div style={{ width: '48px', height: '2px', background: '#cc0000', marginBottom: '20px' }} />
        <div className="mobile-hero-title" style={{ fontSize: '80px', fontWeight: '700', color: '#fff', letterSpacing: '6px', textTransform: 'uppercase', lineHeight: '1', marginBottom: '8px' }}>
          Emergency
        </div>
        <div className="mobile-hero-title" style={{ fontSize: '80px', fontWeight: '700', color: '#cc0000', letterSpacing: '6px', textTransform: 'uppercase', lineHeight: '1', marginBottom: '12px' }}>
          SOS
        </div>
        <div style={{ fontSize: '22px', fontWeight: '300', color: '#666', letterSpacing: '10px', textTransform: 'uppercase', marginBottom: '28px' }}>
          System
        </div>
        <div style={{ fontSize: '15px', color: '#555', letterSpacing: '1px', maxWidth: '460px', lineHeight: '1.8', marginBottom: '48px', fontWeight: '300' }}>
          Real-time volunteer coordination powered by AI. Trigger an SOS instantly and get connected to nearby volunteers within seconds.
        </div>
        <div className="mobile-btn-stack" style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={() => navigate('/victim')}
            style={{ padding: '15px 44px', background: '#cc0000', border: 'none', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: '13px', letterSpacing: '4px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', fontWeight: '500' }}
          >
            I Need Help
          </button>
          <button
            onClick={() => navigate('/volunteer')}
            style={{ padding: '15px 44px', background: 'transparent', border: '1px solid #2a2a2a', color: '#666', fontFamily: 'Oswald, sans-serif', fontSize: '13px', letterSpacing: '4px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', fontWeight: '500' }}
          >
            I Want To Help
          </button>
        </div>
      </div>

      {/* Red bar */}
      <div style={{ height: '2px', background: 'linear-gradient(90deg, #0a0a0a, #cc0000, #0a0a0a)' }} />

      {/* Stats */}
      <div className="mobile-stats" style={{ display: 'flex', borderBottom: '1px solid #1c1c1c' }}>
        {[
          { num: completedCount, label: 'People Helped (Rescues)' },
          { num: activeCount, label: 'Active Emergencies' },
          { num: logs.length, label: 'Total Incident Logs' },
          { num: '24/7', label: 'Always Online' },
        ].map((stat, i) => (
          <div key={i} style={{ flex: 1, padding: '28px 16px', textAlign: 'center', borderRight: i < 3 ? '1px solid #1c1c1c' : 'none' }}>
            <div style={{ fontSize: '40px', fontWeight: '700', color: '#cc0000', letterSpacing: '2px' }}>{stat.num}</div>
            <div style={{ fontSize: '11px', color: '#444', letterSpacing: '4px', textTransform: 'uppercase', marginTop: '4px', fontWeight: '300' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Live Map Overview */}
      <div style={{ padding: '48px 48px 0 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '5px', color: '#cc0000', textTransform: 'uppercase', marginBottom: '6px' }}>
              Geospatial Operations Map
            </div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Live Emergency & Volunteer Network
            </div>
            <div style={{ fontSize: '12px', color: '#666', letterSpacing: '1px', marginTop: '4px' }}>
              Live geographical view of active and resolved incidents alongside verified patrolling volunteer units across Davanagere.
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#00cc44', letterSpacing: '1px', textTransform: 'uppercase', border: '1px solid #005511', padding: '6px 14px', borderRadius: '3px', background: '#001a00' }}>
            ● Continuous Live Tracking Active
          </div>
        </div>

        <SOSMap
          incidentMarkers={logs}
          radarBots={radarBots}
          height="380px"
        />
      </div>

      {/* Red divider */}
      <div style={{ height: '1px', background: '#1c1c1c', margin: '48px 48px 0 48px' }} />

      {/* Public Activity Log */}
      <div style={{ padding: '48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '5px', color: '#cc0000', textTransform: 'uppercase', marginBottom: '6px' }}>
              Live Civic Audit Feed
            </div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Incident & Rescue Records
            </div>
            <div style={{ fontSize: '12px', color: '#666', letterSpacing: '1px', marginTop: '4px' }}>
              Transparent record of all emergency distress calls, volunteer dispatches, and resolved rescues.
            </div>
          </div>

          {/* Filter buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '8px 18px',
                background: filter === 'all' ? '#cc0000' : '#111',
                border: '1px solid #222',
                color: filter === 'all' ? '#fff' : '#666',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '3px'
              }}
            >
              All Records ({logs.length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              style={{
                padding: '8px 18px',
                background: filter === 'completed' ? '#006622' : '#111',
                border: filter === 'completed' ? '1px solid #00cc44' : '1px solid #222',
                color: filter === 'completed' ? '#00ff55' : '#666',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '3px'
              }}
            >
              People Helped ({completedCount})
            </button>
            <button
              onClick={() => setFilter('active')}
              style={{
                padding: '8px 18px',
                background: filter === 'active' ? '#663300' : '#111',
                border: filter === 'active' ? '1px solid #ff9900' : '1px solid #222',
                color: filter === 'active' ? '#ffaa00' : '#666',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '3px'
              }}
            >
              Active Now ({activeCount})
            </button>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#333', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', padding: '60px', background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: '4px' }}>
            No incident records in this view
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
            {filteredLogs.map((log, i) => (
              <div
                key={log._id || i}
                style={{
                  background: '#111',
                  border: log.status === 'completed' ? '1px solid #1a331a' : (log.status === 'pending' ? '1px solid #331a1a' : '1px solid #332b1a'),
                  borderRadius: '4px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: log.status === 'completed' ? '0 0 10px rgba(0, 204, 68, 0.05)' : 'none'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>{getCategoryIcon(log.category)}</span>
                      <div>
                        <div style={{ fontSize: '15px', color: '#fff', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '600' }}>
                          {log.category ? log.category.replace('_', ' ') : 'EMERGENCY'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#555', letterSpacing: '1px' }}>
                          Victim: <strong style={{ color: '#aaa' }}>{log.victimId?.name || 'Anonymous Citizen'}</strong>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '10px',
                        color: getStatusColor(log.status),
                        letterSpacing: '2px',
                        textTransform: 'uppercase',
                        border: `1px solid ${getStatusColor(log.status)}`,
                        padding: '4px 10px',
                        borderRadius: '3px',
                        fontWeight: '600',
                        background: log.status === 'completed' ? '#002200' : (log.status === 'pending' ? '#1a0000' : '#221500')
                      }}
                    >
                      {log.status === 'pending' ? '● LIVE ALERT' : (log.status === 'accepted' || log.status === 'responding' ? '⚡ RESCUE IN PROGRESS' : '✓ RESOLVED')}
                    </div>
                  </div>

                  {log.description ? (
                    <div style={{ fontSize: '13px', color: '#888', fontStyle: 'italic', marginBottom: '12px', background: '#0a0a0a', padding: '8px 12px', borderRadius: '3px', border: '1px solid #181818' }}>
                      "{log.description}"
                    </div>
                  ) : null}

                  {log.location?.coordinates && (
                    <div style={{ fontSize: '11px', color: '#444', letterSpacing: '1px', marginBottom: '10px' }}>
                      📍 Davanagere Region ({log.location.coordinates[1].toFixed(4)}, {log.location.coordinates[0].toFixed(4)})
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #1c1c1c', paddingTop: '12px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  {log.assignedVolunteer ? (
                    <div style={{ fontSize: '11px', color: '#00cc44', letterSpacing: '1px' }}>
                      ✅ Assisted by Volunteer <strong style={{ color: '#00ff66' }}>{log.assignedVolunteer.name}</strong>
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#ffaa00', letterSpacing: '1px' }}>
                      {log.status === 'pending' ? '⏳ Dispatching Nearby Responders' : 'Emergency Closed'}
                    </div>
                  )}

                  <div style={{ fontSize: '11px', color: '#444', letterSpacing: '1px' }}>
                    {timeAgo(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}