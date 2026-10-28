import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import api from '../services/api'
import SOSMap from '../components/SOSMap'
import ChatBox from '../components/ChatBox'

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const S = {
  page: { minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Oswald, sans-serif' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 48px', borderBottom: '1px solid #1c1c1c' },
  logo: { color: '#fff', fontSize: '20px', letterSpacing: '6px', fontWeight: '600', textTransform: 'uppercase' },
  navLinks: { display: 'flex', gap: '32px' },
  navLink: { color: '#555', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer' },
  navActive: { color: '#fff', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer' },
  redBar: { height: '2px', background: 'linear-gradient(90deg, #0a0a0a, #cc0000, #0a0a0a)' },
  body: { display: 'flex', minHeight: 'calc(100vh - 57px)' },
  left: { flex: 1, padding: '60px 48px', borderRight: '1px solid #1c1c1c', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  right: { flex: 1, padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  tag: { fontSize: '11px', letterSpacing: '5px', color: '#cc0000', textTransform: 'uppercase', marginBottom: '16px' },
  title: { fontSize: '52px', fontWeight: '700', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', lineHeight: '1.1', marginBottom: '16px' },
  titleRed: { color: '#cc0000' },
  desc: { fontSize: '14px', color: '#555', letterSpacing: '1px', lineHeight: '1.8', fontWeight: '300', maxWidth: '340px' },
  label: { fontSize: '11px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase', marginBottom: '8px' },
  input: { background: '#111', border: '1px solid #222', color: '#fff', padding: '12px 16px', fontFamily: 'Oswald, sans-serif', fontSize: '14px', letterSpacing: '1px', borderRadius: '3px', width: '100%', outline: 'none', marginBottom: '20px' },
  btnRed: { width: '100%', padding: '14px', background: '#cc0000', border: 'none', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: '13px', letterSpacing: '4px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', marginBottom: '12px' },
  btnOut: { width: '100%', padding: '14px', background: 'transparent', border: '1px solid #222', color: '#555', fontFamily: 'Oswald, sans-serif', fontSize: '13px', letterSpacing: '4px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', marginBottom: '20px' },
  btnGreen: { width: '100%', padding: '14px', background: '#006622', border: '1px solid #00cc44', color: '#00cc44', fontFamily: 'Oswald, sans-serif', fontSize: '13px', letterSpacing: '4px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', marginBottom: '12px' },
  error: { color: '#cc0000', fontSize: '12px', letterSpacing: '2px', marginBottom: '12px' },
  success: { color: '#00cc44', fontSize: '12px', letterSpacing: '2px', marginBottom: '12px' },
  divider: { height: '1px', background: '#1c1c1c', margin: '24px 0' },
}

// ─── LOGIN FORM ───────────────────────────────────────────────
function LoginForm() {
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState('phone')
  const [isNewUser, setIsNewUser] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const sendOTP = async () => {
    const cleanDigits = phone.replace(/[^\d]/g, '').slice(-10)
    if (!cleanDigits || cleanDigits.length !== 10 || !/^[6-9]\d{9}$/.test(cleanDigits)) {
      return setError('Please enter a valid 10-digit mobile number (starting with 6, 7, 8, or 9)')
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/send-otp', { phone: cleanDigits, role: 'volunteer' })
      if (res.data.isExistingUser && res.data.token) {
        setSuccess(`Welcome back, ${res.data.user.name}! Direct login successful.`)
        login(res.data.user, res.data.token)
        return
      }
      setOtp('')
      setSuccess('OTP has been sent to your phone! Please enter the 6-digit code received via SMS.')
      setIsNewUser(true)
      setStep('otp')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const verifyOTP = async () => {
    if (!otp) return setError('Enter OTP')
    if (isNewUser && !name) {
      return setError('Please enter your name to complete registration')
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/verify-otp', {
        phone,
        otp,
        name: name || undefined,
        role: 'volunteer'
      })
      if (res.data.isNewUser && !name) {
        setIsNewUser(true)
        setLoading(false)
        return setError('Please enter your name above to complete registration')
      }
      login(res.data.user, res.data.token)
    } catch (err) {
      if (err.response?.data?.isNewUser) {
        setIsNewUser(true)
        setError('Please enter your name above to complete registration')
      } else {
        setError(err.response?.data?.message || 'Invalid OTP')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={S.tag}>Volunteer Access</div>
      <div style={S.title}>
        Ready to<br /><span style={S.titleRed}>Help.</span>
      </div>
      <div style={S.desc}>
        Register as a volunteer to receive nearby SOS alerts and help people in emergencies.
      </div>
      <div style={S.divider} />

      {error && <div style={S.error}>{error}</div>}
      {success && <div style={S.success}>{success}</div>}

      {step === 'phone' && (
        <>
          <div style={S.label}>Phone Number (10 Digits)</div>
          <input
            style={S.input}
            type="tel"
            maxLength={10}
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
            onKeyDown={e => e.key === 'Enter' && sendOTP()}
          />
          <button style={S.btnRed} onClick={sendOTP} disabled={loading}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </>
      )}

      {step === 'otp' && (
        <>
          <div style={S.label}>Phone Number</div>
          <input style={{ ...S.input, color: '#555' }} value={phone} readOnly />

          {isNewUser && (
            <>
              <div style={S.label}>Your Name</div>
              <input
                style={S.input}
                placeholder="Enter your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </>
          )}

          <div style={S.label}>Enter OTP</div>
          <input
            style={S.input}
            placeholder="6-digit OTP"
            value={otp}
            onChange={e => setOtp(e.target.value)}
            maxLength={6}
            onKeyDown={e => e.key === 'Enter' && verifyOTP()}
          />

          <button style={S.btnRed} onClick={verifyOTP} disabled={loading}>
            {loading ? 'Verifying...' : isNewUser ? 'Register & Enter' : 'Sign In'}
          </button>
          <button
            style={S.btnOut}
            onClick={() => {
              setStep('phone')
              setError('')
              setSuccess('')
              setIsNewUser(false)
              setOtp('')
              setName('')
            }}
          >
            Change Number
          </button>
        </>
      )}
    </div>
  )
}

// ─── VOLUNTEER DASHBOARD ──────────────────────────────────────
function VolunteerDashboard({ radarBots = [] }) {
  const { user, logout, socket } = useAuth()
  const [sosRequests, setSosRequests] = useState([])
  const [activeSOS, setActiveSOS] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [victimLocation, setVictimLocation] = useState(null)
  const [volunteerLocation, setVolunteerLocation] = useState(null)

  const fetchVolunteerData = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    api.get('/sos?role=volunteer', { params: { _t: Date.now() } })
      .then(res => {
        const requests = res.data.requests || []
        const pending = requests.filter(r => r.status === 'pending')
        setSosRequests(pending)

        const myId = String(user?._id || user?.id || '')
        const accepted = myId ? requests.find(r => {
          const assignedId = String(r.assignedVolunteer?._id || r.assignedVolunteer || '')
          return assignedId && (r.status === 'accepted' || r.status === 'responding') && assignedId === myId
        }) : null

        if (accepted) {
          setActiveSOS(accepted)
          if (socket) socket.emit('join_sos_room', accepted._id)
          if (accepted.victimId?.location?.coordinates) {
            setVictimLocation({
              lat: accepted.victimId.location.coordinates[1],
              lng: accepted.victimId.location.coordinates[0]
            })
          }
        } else {
          setActiveSOS(null)
          setVictimLocation(null)
        }
      })
      .catch(err => {
        if (!silent) console.error('Error fetching volunteer SOS:', err)
      })
      .finally(() => {
        if (!silent) setLoading(false)
      })

    api.get('/sos/history', { params: { _t: Date.now() } })
      .then(res => {
        if (res.data.history) setHistory(res.data.history)
      })
      .catch(() => {})
  }, [user?._id, user?.id, socket])

  useEffect(() => {
    fetchVolunteerData()

    // 2. Geolocation with fallback default coordinates
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setVolunteerLocation({ lat, lng })
        api.put('/volunteers/location', { latitude: lat, longitude: lng }).catch(() => {})
      }, (err) => {
        console.warn('Geolocation warning, using fallback:', err.message)
        setVolunteerLocation({ lat: 14.4673, lng: 75.9218 })
      }, { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 })
    } else {
      setVolunteerLocation({ lat: 14.4673, lng: 75.9218 })
    }

    const tracker = setInterval(() => {
      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setVolunteerLocation({ lat, lng })
        api.put('/volunteers/location', { latitude: lat, longitude: lng }).catch(() => {})
      }, (err) => {
        console.error('Location error:', err)
      }, GEO_OPTIONS)
    }, 10000)

    window._volunteerTracker = tracker

    // 3. Auto-sync queue every 4 seconds when not currently in active rescue
    const queueInterval = setInterval(() => {
      fetchVolunteerData(true)
    }, 4000)

    if (socket) {
      socket.on('new_sos_request', (data) => {
        setSuccess(`🚨 New SOS nearby — ${data.category.replace('_', ' ')} by ${data.victimName}`)
        fetchVolunteerData(true)
      })

      socket.on('sos_cancelled', (data) => {
        setActiveSOS(current => {
          if (current && String(current._id) === String(data.sosId)) {
            setError('Victim cancelled the SOS request.')
            setVictimLocation(null)
            return null
          }
          return current
        })
        fetchVolunteerData(true)
      })

      socket.on('sos_completed', (data) => {
        setActiveSOS(current => {
          if (current && String(current._id) === String(data.sosId)) {
            setSuccess('Rescue completed!')
            setVictimLocation(null)
            return null
          }
          return current
        })
        fetchVolunteerData(true)
      })

      socket.on('sos_status_changed', () => {
        fetchVolunteerData(true)
      })

      socket.on('victim_location_update', (data) => {
        setVictimLocation(data.location)
      })
    }

    return () => {
      clearInterval(tracker)
      clearInterval(queueInterval)
      window._volunteerTracker = null
      if (socket) {
        socket.off('new_sos_request')
        socket.off('sos_cancelled')
        socket.off('sos_completed')
        socket.off('sos_status_changed')
        socket.off('victim_location_update')
      }
    }
  }, [socket, fetchVolunteerData])

  const acceptSOS = async (sosId) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.put(`/sos/${sosId}/accept`)
      setActiveSOS(res.data.sos)
      setSosRequests([])
      setSuccess('SOS accepted. Navigate to victim location.')
      if (socket) socket.emit('join_sos_room', sosId)
      const sos = res.data.sos
      if (sos.location?.coordinates) {
        setVictimLocation({
          lat: sos.location.coordinates[1],
          lng: sos.location.coordinates[0]
        })
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept SOS')
    } finally {
      setLoading(false)
    }
  }



  const completeSOS = async () => {
    if (!activeSOS) return
    setLoading(true)
    try {
      await api.put(`/sos/${activeSOS._id}/complete`)
      if (socket) socket.emit('leave_sos_room', activeSOS._id)
      setActiveSOS(null)
      setVictimLocation(null)
      setSuccess('Rescue completed. Great work!')
      api.get('/sos/history')
        .then(res => setHistory(res.data.history || []))
        .catch(() => {})
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete')
    } finally {
      setLoading(false)
    }
  }

  const refreshRequests = () => {
    setLoading(true)
    api.get('/sos?role=volunteer', { params: { _t: Date.now() } })
      .then(res => {
        const requests = res.data.requests || []
        const pending = requests.filter(r => r.status === 'pending')
        setSosRequests(pending)

        const myId = String(user?._id || user?.id || '')
        const accepted = myId ? requests.find(r => {
          const assignedId = String(r.assignedVolunteer?._id || r.assignedVolunteer || '')
          return assignedId && (r.status === 'accepted' || r.status === 'responding') && assignedId === myId
        }) : null
        if (accepted) {
          setActiveSOS(accepted)
          if (socket) socket.emit('join_sos_room', accepted._id)
          if (accepted.victimId?.location?.coordinates) {
            setVictimLocation({
              lat: accepted.victimId.location.coordinates[1],
              lng: accepted.victimId.location.coordinates[0]
            })
          }
        } else {
          setActiveSOS(null)
          setVictimLocation(null)
        }
        setSuccess(`Refreshed: ${pending.length} pending request${pending.length === 1 ? '' : 's'}`)
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to refresh'))
      .finally(() => setLoading(false))
  }

  const getCategoryColor = (severity) => {
    if (severity === 'critical') return '#cc0000'
    if (severity === 'high') return '#ff6600'
    if (severity === 'medium') return '#ffaa00'
    return '#888'
  }

  return (
    <div className="mobile-stack" style={{ display: 'flex', minHeight: 'calc(100vh - 57px)' }}>
      <div className="mobile-p-20" style={{ flex: 1, padding: '48px', borderRight: '1px solid #1c1c1c', overflowY: 'auto' }}>
        <div className="mobile-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <div style={S.tag}>Volunteer Dashboard</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Welcome, {user.name}
            </div>
          </div>
          <button
            onClick={logout}
            style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #222', color: '#555', fontFamily: 'Oswald, sans-serif', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
          >
            Logout
          </button>
        </div>

        {error && <div style={S.error}>{error}</div>}
        {success && <div style={S.success}>{success}</div>}

        {!activeSOS ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={S.tag}>Nearby SOS Requests</div>
              <button
                onClick={refreshRequests}
                style={{ padding: '6px 16px', background: 'transparent', border: '1px solid #222', color: '#555', fontFamily: 'Oswald, sans-serif', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
              >
                Refresh
              </button>
            </div>

            {sosRequests.length === 0 ? (
              <div style={{ background: '#111', border: '1px solid #1c1c1c', borderRadius: '4px', padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', color: '#333', letterSpacing: '3px', textTransform: 'uppercase' }}>
                  No nearby SOS requests
                </div>
                <div style={{ fontSize: '11px', color: '#222', letterSpacing: '2px', marginTop: '8px' }}>
                  You will be notified when someone needs help nearby
                </div>
              </div>
            ) : (
              sosRequests.map((sos) => (
                <div key={sos._id} style={{ background: '#111', border: '1px solid #1c1c1c', borderRadius: '4px', padding: '20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '16px', color: '#fff', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
                        {sos.category.replace('_', ' ')}
                      </div>
                      <div style={{ fontSize: '11px', color: '#444', letterSpacing: '2px' }}>
                        By {sos.victimId?.name || 'Unknown'} • {new Date(sos.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: getCategoryColor(sos.severity), letterSpacing: '2px', textTransform: 'uppercase', border: `1px solid ${getCategoryColor(sos.severity)}`, padding: '4px 10px', borderRadius: '3px' }}>
                      {sos.severity || 'medium'}
                    </div>
                  </div>

                  {sos.description && (
                    <div style={{ fontSize: '12px', color: '#555', letterSpacing: '1px', marginBottom: '12px', lineHeight: '1.6' }}>
                      {sos.description}
                    </div>
                  )}

                  {volunteerLocation && sos.location?.coordinates && (
                    <div style={{ background: '#0a0a0a', border: '1px solid #1c1c1c', borderRadius: '3px', padding: '10px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#555', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Distance from you
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '600', color: '#cc0000', letterSpacing: '2px' }}>
                        {calculateDistance(
                          volunteerLocation.lat,
                          volunteerLocation.lng,
                          sos.location.coordinates[1],
                          sos.location.coordinates[0]
                        ).toFixed(2)} km away
                      </div>
                      <div style={{ fontSize: '11px', color: '#444', letterSpacing: '1px', marginTop: '4px' }}>
                        📍 {sos.location.coordinates[1].toFixed(4)}, {sos.location.coordinates[0].toFixed(4)}
                      </div>
                    </div>
                  )}

                  {sos.aiAnalysis?.summary && (
                    <div style={{ background: '#0d0d0d', border: '1px solid #1c1c1c', borderRadius: '3px', padding: '10px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', color: '#cc0000', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '4px' }}>AI Summary</div>
                      <div style={{ fontSize: '12px', color: '#555', letterSpacing: '1px', lineHeight: '1.6' }}>{sos.aiAnalysis.summary}</div>
                    </div>
                  )}

                  <button
                    onClick={() => acceptSOS(sos._id)}
                    disabled={loading}
                    style={S.btnGreen}
                  >
                    {loading ? 'Accepting...' : 'Accept & Respond'}
                  </button>
                </div>
              ))
            )}
          </>
        ) : (
          <div>
            <div style={{ background: '#001a00', border: '1px solid #00cc44', borderRadius: '4px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#00cc44', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '8px' }}>
                ● Responding — {activeSOS.category?.replace('_', ' ')}
              </div>
              <div style={{ fontSize: '13px', color: '#888', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Victim: <span style={{ color: '#fff', fontWeight: '600' }}>{activeSOS.victimId?.name || 'Unknown'}</span>
              </div>
              {activeSOS.victimId?.phone && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  background: '#0d180d', 
                  border: '1px solid #00aa33', 
                  borderRadius: '4px', 
                  padding: '10px 14px', 
                  marginBottom: '14px' 
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#00cc44', letterSpacing: '2px', textTransform: 'uppercase' }}>
                      Victim Contact Number
                    </div>
                    <div style={{ fontSize: '15px', color: '#fff', letterSpacing: '2px', fontWeight: '600', marginTop: '2px' }}>
                      {activeSOS.victimId.phone.startsWith('+91') ? activeSOS.victimId.phone : `+91 ${activeSOS.victimId.phone}`}
                    </div>
                  </div>
                  <a
                    href={`tel:${activeSOS.victimId.phone}`}
                    style={{
                      padding: '8px 16px',
                      background: '#00cc44',
                      color: '#000',
                      textDecoration: 'none',
                      fontFamily: 'Oswald, sans-serif',
                      fontSize: '12px',
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      fontWeight: 'bold',
                      borderRadius: '3px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    📞 Call Victim
                  </a>
                </div>
              )}
              <div style={{ fontSize: '13px', color: '#555', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>
                Status: {activeSOS.status}
              </div>

              <button
                onClick={completeSOS}
                disabled={loading}
                style={S.btnGreen}
              >
                {loading ? 'Completing...' : 'Mark Rescue Complete'}
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#555', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Navigation Map
              </div>
              <SOSMap
                victimLocation={victimLocation}
                volunteerLocation={volunteerLocation}
                showRoute={true}
                radarBots={radarBots}
              />
            </div>

            <div style={{ marginTop: '20px' }}>
              <ChatBox
                sosId={activeSOS._id}
                partnerName={activeSOS.victimId?.name}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mobile-p-20" style={{ flex: 1, padding: '48px', overflowY: 'auto' }}>
        {/* Live Patrolling Radar (Simulated Network) */}
        {!activeSOS && (
          <div style={{ marginBottom: '36px' }}>
            <div style={S.tag}>Live Active Radar</div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>
              Patrolling Units
            </div>
            <div style={{ fontSize: '11px', color: '#555', letterSpacing: '1px', marginBottom: '14px', lineHeight: '1.6' }}>
              Real-time simulated volunteer positions roaming Davanagere. Real human volunteer locations remain strictly confidential.
            </div>
            <SOSMap
              volunteerLocation={volunteerLocation}
              radarBots={radarBots}
            />
          </div>
        )}

        <div style={S.tag}>Rescue Log</div>
        <div style={{ fontSize: '22px', fontWeight: '600', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>
          Rescue History
        </div>
        <div style={{ fontSize: '13px', color: '#cc0000', letterSpacing: '2px', marginBottom: '24px' }}>
          {user.rescueCount || 0} Total Rescues
        </div>

        {history.length === 0 ? (
          <div style={{ color: '#333', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', textAlign: 'center', marginTop: '60px', lineHeight: '2' }}>
            No rescues yet.<br />Accept an SOS to get started.
          </div>
        ) : (
          history.map((h, i) => (
            <div key={i} style={{ background: '#111', border: '1px solid #1c1c1c', borderRadius: '4px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '15px', color: '#fff', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  {h.category.replace('_', ' ')}
                </div>
                <div style={{ fontSize: '11px', color: h.status === 'completed' ? '#00cc44' : '#666', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  {h.status}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#444', letterSpacing: '2px', marginTop: '4px' }}>
                Victim: {h.victimId?.name || 'Unknown'}
              </div>
              <div style={{ fontSize: '11px', color: '#333', letterSpacing: '2px', marginTop: '4px' }}>
                {new Date(h.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── MAIN VOLUNTEER PAGE ──────────────────────────────────────
export default function Volunteer() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [radarBots, setRadarBots] = useState([])

  useEffect(() => {
    const fetchRadar = () => {
      api.get('/volunteers/radar-bots')
        .then(res => {
          if (res.data?.bots) setRadarBots(res.data.bots)
        })
        .catch(err => console.warn('Radar fetch failed:', err.message))
    }
    fetchRadar()
    const timer = setInterval(fetchRadar, 8000)
    return () => clearInterval(timer)
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#cc0000', fontSize: '13px', letterSpacing: '4px', textTransform: 'uppercase' }}>Loading...</div>
    </div>
  )

  if (user && user.role === 'victim') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Oswald, sans-serif' }}>
        <nav style={S.nav}>
          <div style={S.logo}><span style={{ color: '#cc0000' }}>&#9675;</span> Emergency SOS</div>
          <div style={S.navLinks}>
            <span onClick={() => navigate('/')} style={S.navLink}>Home</span>
            <span onClick={() => navigate('/victim')} style={S.navLink}>Victim</span>
            <span style={S.navActive}>Volunteer</span>
          </div>
        </nav>
        <div style={S.redBar} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 57px)', textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '11px', color: '#cc0000', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: '16px' }}>Access Denied</div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
            You're in an<br /><span style={{ color: '#cc0000' }}>Emergency.</span>
          </div>
          <div style={{ fontSize: '14px', color: '#555', letterSpacing: '2px', marginBottom: '32px' }}>
            You can't help others while you need help yourself. Abort your SOS first.
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => navigate('/victim')}
              style={{ padding: '14px 30px', background: '#cc0000', border: 'none', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: '13px', letterSpacing: '4px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
            >
              Back to My SOS
            </button>
            <button
              onClick={logout}
              style={{ padding: '14px 30px', background: 'transparent', border: '1px solid #333', color: '#888', fontFamily: 'Oswald, sans-serif', fontSize: '13px', letterSpacing: '4px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
            >
              Logout & Switch Role
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <nav className="mobile-nav" style={S.nav}>
        <div style={S.logo}><span style={{ color: '#cc0000' }}>&#9675;</span> Emergency SOS</div>
        <div className="mobile-nav-links" style={S.navLinks}>
          <span onClick={() => navigate('/')} style={S.navLink}>Home</span>
          <span onClick={() => navigate('/victim')} style={S.navLink}>Victim</span>
          <span style={S.navActive}>Volunteer</span>
        </div>
      </nav>
      <div style={S.redBar} />

      {!user ? (
        <div className="mobile-stack" style={S.body}>
          <div className="mobile-p-20" style={S.left}>
            <div style={S.tag}>Emergency SOS</div>
            <div className="mobile-title" style={S.title}>I Want to<br /><span style={S.titleRed}>Help.</span></div>
            <div style={S.desc}>Register as a volunteer to receive nearby SOS alerts and help people in emergencies near you.</div>
          </div>
          <div className="mobile-p-20" style={S.right}>
            <LoginForm />
          </div>
        </div>
      ) : (
        <VolunteerDashboard radarBots={radarBots} />
      )}
    </div>
  )
}