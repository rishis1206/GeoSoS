import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import api from '../services/api'
import SOSMap from '../components/SOSMap'
import AIAssistant from '../components/AIAssistant'
import ChatBox from '../components/ChatBox'

const CATEGORIES = [
  { id: 'medical', label: 'Medical' },
  { id: 'accident', label: 'Accident' },
  { id: 'fire', label: 'Fire' },
  { id: 'assault', label: 'Assault' },
  { id: 'natural_disaster', label: 'Natural Disaster' },
  { id: 'other', label: 'Other' },
]

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
  roleBtn: { flex: 1, padding: '11px', border: '1px solid #222', background: '#111', color: '#555', fontFamily: 'Oswald, sans-serif', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' },
  roleBtnActive: { flex: 1, padding: '11px', border: '1px solid #cc0000', background: '#1a0000', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' },
  error: { color: '#cc0000', fontSize: '12px', letterSpacing: '2px', marginBottom: '12px' },
  success: { color: '#00cc44', fontSize: '12px', letterSpacing: '2px', marginBottom: '12px' },
  divider: { height: '1px', background: '#1c1c1c', margin: '24px 0' },
}

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0
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
      const res = await api.post('/auth/send-otp', { phone: cleanDigits, role: 'victim' })
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
        role: 'victim'
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
      <div style={S.tag}>Secure Access</div>
      <div style={S.title}>
        Get Help<br /><span style={S.titleRed}>Fast.</span>
      </div>
      <div style={S.desc}>
        Register your phone to instantly trigger SOS alerts. Nearby volunteers will be dispatched to your exact location.
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

// ─── SOS DASHBOARD ────────────────────────────────────────────
function SOSDashboard() {
  const { user, logout, socket } = useAuth()
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [activeSOS, setActiveSOS] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [victimLocation, setVictimLocation] = useState(null)
  const [volunteerLocation, setVolunteerLocation] = useState(null)
  const [batteryLevel, setBatteryLevel] = useState(null)
  const [isLowBattery, setIsLowBattery] = useState(false)
  const [powerSavingMode, setPowerSavingMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [nearbyHospitals, setNearbyHospitals] = useState([])
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', phone: '', relationship: '' })
  const [selectedLanguage, setSelectedLanguage] = useState('en')

  useEffect(() => {
    api.get('/sos')
      .then(res => {
        console.log('Fetched SOS for victim:', res.data)
        if (res.data.requests && res.data.requests.length > 0) {
          const sos = res.data.requests[0]
          setActiveSOS(sos)
          if (sos.location?.coordinates) {
            setVictimLocation({
              lat: sos.location.coordinates[1],
              lng: sos.location.coordinates[0]
            })
          }
        } else {
          console.log('No active SOS found for victim')
        }
      })
      .catch(err => console.error('Error fetching SOS:', err))

    api.get('/sos/history')
      .then(res => {
        console.log('Fetched SOS history:', res.data)
        if (res.data.history) setHistory(res.data.history)
      })
      .catch(err => console.error('Error fetching history:', err))

    // Battery monitoring
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setBatteryLevel(battery.level * 100)
        setIsLowBattery(battery.level < 0.2)
        
        const handleLevelChange = () => {
          setBatteryLevel(battery.level * 100)
          setIsLowBattery(battery.level < 0.2)
          if (battery.level < 0.15 && activeSOS) {
            setSuccess('⚠️ Low battery! SOS will continue but location updates may slow.')
          }
        }
        
        battery.addEventListener('levelchange', handleLevelChange)
        return () => battery.removeEventListener('levelchange', handleLevelChange)
      })
    }

    // Check for Web Speech API support
    setVoiceSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

    // DISABLED: Nearby hospitals causing excessive API requests
    // // Fetch nearby hospitals when SOS is active
    // if (activeSOS && victimLocation) {
    //   api.get(`/sos/nearby-hospitals?lat=${victimLocation.lat}&lng=${victimLocation.lng}`)
    //     .then(res => {
    //       if (res.data.hospitals) {
    //         setNearbyHospitals(res.data.hospitals)
    //       }
    //     })
    //     .catch(() => {})
    // }

    if (socket) {
      socket.on('sos_accepted', (data) => {
        setSuccess(`✅ Volunteer ${data.volunteer?.name || 'Responder'} is on the way!`)
        setActiveSOS(prev => prev ? {
          ...prev,
          status: 'accepted',
          assignedVolunteer: data.volunteer
        } : prev)
      })

      socket.on('sos_completed', () => {
        setActiveSOS(null)
        setSuccess('Rescue completed. You are safe!')
        api.get('/sos/history', { params: { _t: Date.now() } })
          .then(res => setHistory(res.data.history || []))
          .catch(() => {})
      })

      socket.on('sos_status_changed', (data) => {
        if (data.status === 'completed' || data.status === 'cancelled') {
          setActiveSOS(null)
          api.get('/sos/history', { params: { _t: Date.now() } })
            .then(res => setHistory(res.data.history || []))
            .catch(() => {})
        } else if (data.status === 'accepted' && data.assignedVolunteer) {
          setActiveSOS(prev => prev ? {
            ...prev,
            status: 'accepted',
            assignedVolunteer: data.assignedVolunteer
          } : prev)
        }
      })

      socket.on('volunteer_location_update', (data) => {
        setVolunteerLocation(data.location)
      })
    }

    return () => {
      if (window._sosTracker) {
        clearInterval(window._sosTracker)
        window._sosTracker = null
      }
      if (socket) {
        socket.off('sos_accepted')
        socket.off('sos_completed')
        socket.off('sos_status_changed')
        socket.off('volunteer_location_update')
      }
    }
  }, [socket, activeSOS])

  const triggerSOS = async () => {
    if (!category) return setError('Select an emergency category first')
    setLoading(true)
    setError('')

    const postSOS = async (lat, lng) => {
      setVictimLocation({ lat, lng })
      try {
        const res = await api.post('/sos', {
          category,
          description,
          latitude: lat,
          longitude: lng,
        })
        setActiveSOS(res.data.sos)
        setSuccess('SOS triggered! Searching for nearby volunteers...')

        api.get('/sos/history')
          .then(res => setHistory(res.data.history || []))
          .catch(() => {})

        if (socket) socket.emit('join_sos_room', res.data.sos._id)

        // Adjust tracking interval based on battery level
        const trackingInterval = isLowBattery ? 30000 : 10000 // 30s if low battery, 10s normal
        
        const tracker = setInterval(() => {
          navigator.geolocation.getCurrentPosition(p => {
            const newLat = p.coords.latitude
            const newLng = p.coords.longitude
            setVictimLocation({ lat: newLat, lng: newLng })
            api.put('/users/location', {
              latitude: newLat,
              longitude: newLng
            }).catch(() => {})
            if (socket) socket.emit('update_location', {
              latitude: newLat,
              longitude: newLng,
              sosId: res.data.sos._id
            })
          }, (err) => console.error('Location error:', err), GEO_OPTIONS)
        }, trackingInterval)

        window._sosTracker = tracker

      } catch (err) {
        setError(err.response?.data?.message || 'Failed to trigger SOS')
      } finally {
        setLoading(false)
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          postSOS(pos.coords.latitude, pos.coords.longitude)
        },
        (err) => {
          console.warn('Geolocation failed or denied, using fallback coordinates:', err)
          postSOS(14.4673, 75.9218)
        },
        GEO_OPTIONS
      )
    } else {
      postSOS(14.4673, 75.9218)
    }
  }

  const cancelSOS = async () => {
    if (!activeSOS) return
    try {
      await api.put(`/sos/${activeSOS._id}/cancel`)
      if (socket) socket.emit('leave_sos_room', activeSOS._id)
      setActiveSOS(null)
      setVictimLocation(null)
      setSuccess('SOS cancelled.')
      api.get('/sos/history')
        .then(res => setHistory(res.data.history || []))
        .catch(() => {})
      if (window._sosTracker) {
        clearInterval(window._sosTracker)
        window._sosTracker = null
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel')
    }
  }

  const callEmergencyServices = async () => {
    if (!activeSOS) return
    try {
      await api.post(`/sos/${activeSOS._id}/emergency-call`)
      setSuccess('Emergency services call logged. Stay safe!')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log call')
    }
  }

  const getEmergencyNumber = async () => {
    try {
      const res = await api.get('/sos/emergency-numbers?country=IN')
      return res.data.numbers.police || '112'
    } catch {
      return '112'
    }
  }

  const startVoiceRecording = () => {
    if (!voiceSupported) {
      setError('Voice input not supported in this browser')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setIsRecording(true)
      setSuccess('Listening... Speak now')
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setDescription(transcript)
      setIsRecording(false)
      setSuccess('Voice recorded successfully')
    }

    recognition.onerror = (event) => {
      setIsRecording(false)
      setError('Voice recognition failed: ' + event.error)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognition.start()
  }

  const addEmergencyContact = async () => {
    if (!newContact.name || !newContact.phone) {
      setError('Name and phone are required')
      return
    }

    try {
      const res = await api.post('/users/emergency-contacts', newContact)
      setSuccess('Emergency contact added successfully')
      setNewContact({ name: '', phone: '', relationship: '' })
      // Refresh user data
      const profileRes = await api.get('/users/profile')
      // Update user context if needed
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add contact')
    }
  }

  const removeEmergencyContact = async (index) => {
    try {
      await api.delete(`/users/emergency-contacts/${index}`)
      setSuccess('Emergency contact removed')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove contact')
    }
  }

  return (
    <div className="mobile-stack" style={{ display: 'flex', minHeight: 'calc(100vh - 57px)' }}>
      <div className="mobile-p-20" style={{ flex: 1, padding: '48px', borderRight: '1px solid #1c1c1c', overflowY: 'auto' }}>
        <div className="mobile-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <div style={S.tag}>Victim Dashboard</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Welcome, {user.name}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {batteryLevel !== null && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 12px',
                background: isLowBattery ? '#1a0500' : '#111',
                border: isLowBattery ? '1px solid #cc0000' : '1px solid #222',
                borderRadius: '3px'
              }}>
                <div style={{ 
                  width: '24px', 
                  height: '12px', 
                  border: '1px solid #555', 
                  borderRadius: '2px',
                  position: 'relative',
                  background: '#111'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '1px',
                    top: '1px',
                    bottom: '1px',
                    width: `${batteryLevel}%`,
                    background: isLowBattery ? '#cc0000' : '#00cc44',
                    borderRadius: '1px'
                  }} />
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: isLowBattery ? '#cc0000' : '#555',
                  letterSpacing: '2px',
                  textTransform: 'uppercase'
                }}>
                  {Math.round(batteryLevel)}%
                </div>
              </div>
            )}
            <button
              onClick={() => setShowEmergencyContacts(!showEmergencyContacts)}
              style={{ padding: '8px 20px', background: '#001a00', border: '1px solid #00cc44', color: '#00cc44', fontFamily: 'Oswald, sans-serif', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
            >
              📞 Emergency Contacts
            </button>
            <select
              value={selectedLanguage}
              onChange={e => setSelectedLanguage(e.target.value)}
              style={{ padding: '8px 12px', background: '#111', border: '1px solid #222', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
              <option value="kn">ಕನ್ನಡ</option>
            </select>
            <button
              onClick={logout}
              style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #222', color: '#555', fontFamily: 'Oswald, sans-serif', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
            >
              Logout
            </button>
          </div>
        </div>

        {error && <div style={S.error}>{error}</div>}
        {success && <div style={S.success}>{success}</div>}

        {/* Emergency Contacts Modal */}
        {showEmergencyContacts && (
          <div style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{ 
              background: '#0d0d0d', 
              border: '1px solid #00cc44', 
              borderRadius: '4px', 
              padding: '24px', 
              width: '90%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '16px', color: '#00cc44', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '600' }}>
                  Emergency Contacts
                </div>
                <button
                  onClick={() => setShowEmergencyContacts(false)}
                  style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '20px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Add New Contact Form */}
              <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #1c1c1c' }}>
                <div style={{ fontSize: '11px', color: '#555', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Add New Contact
                </div>
                <input
                  style={{ ...S.input, marginBottom: '8px' }}
                  placeholder="Name"
                  value={newContact.name}
                  onChange={e => setNewContact({...newContact, name: e.target.value})}
                />
                <input
                  style={{ ...S.input, marginBottom: '8px' }}
                  placeholder="Phone Number"
                  value={newContact.phone}
                  onChange={e => setNewContact({...newContact, phone: e.target.value})}
                />
                <input
                  style={{ ...S.input, marginBottom: '12px' }}
                  placeholder="Relationship (e.g., Parent, Spouse)"
                  value={newContact.relationship}
                  onChange={e => setNewContact({...newContact, relationship: e.target.value})}
                />
                <button
                  onClick={addEmergencyContact}
                  style={{ width: '100%', padding: '10px', background: '#00cc44', border: 'none', color: '#000', fontFamily: 'Oswald, sans-serif', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
                >
                  Add Contact
                </button>
              </div>

              {/* Existing Contacts */}
              <div>
                <div style={{ fontSize: '11px', color: '#555', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Your Contacts
                </div>
                {user.emergencyContacts && user.emergencyContacts.length > 0 ? (
                  user.emergencyContacts.map((contact, index) => (
                    <div key={index} style={{ 
                      background: '#111', 
                      border: '1px solid #222', 
                      borderRadius: '3px', 
                      padding: '12px', 
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>
                          {contact.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
                          {contact.phone}
                        </div>
                        {contact.relationship && (
                          <div style={{ fontSize: '10px', color: '#444' }}>
                            {contact.relationship}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeEmergencyContact(index)}
                        style={{ padding: '6px 12px', background: '#cc0000', border: 'none', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '12px', color: '#444', textAlign: 'center', padding: '20px' }}>
                    No emergency contacts added yet
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', fontSize: '10px', color: '#333', textAlign: 'center' }}>
                These contacts will be notified if no volunteers respond to your SOS
              </div>
            </div>
          </div>
        )}

        {!activeSOS ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <div
                onClick={!loading ? triggerSOS : undefined}
                style={{
                  width: '200px',
                  height: '200px',
                  borderRadius: '50%',
                  background: loading ? '#880000' : '#cc0000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  cursor: 'pointer',
                  boxShadow: '0 0 40px #cc000066, 0 0 80px #cc000033',
                  border: '4px solid #ff2222',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#fff', letterSpacing: '4px', textTransform: 'uppercase' }}>
                  {loading ? '...' : 'SOS'}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#444', letterSpacing: '3px', textTransform: 'uppercase' }}>
                Select category below then press
              </div>
            </div>

            <div style={S.label}>Emergency Category</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '20px' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  style={category === cat.id ? S.roleBtnActive : S.roleBtn}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={S.label}>Description (Optional)</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <textarea
                style={{ ...S.input, height: '80px', resize: 'none', flex: 1 }}
                placeholder="Briefly describe the emergency..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              {voiceSupported && (
                <button
                  onClick={startVoiceRecording}
                  disabled={isRecording}
                  style={{
                    width: '60px',
                    height: '80px',
                    background: isRecording ? '#cc0000' : '#111',
                    border: isRecording ? '1px solid #cc0000' : '1px solid #222',
                    color: isRecording ? '#fff' : '#555',
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: '24px',
                    cursor: 'pointer',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={isRecording ? 'Recording...' : 'Voice input'}
                >
                  {isRecording ? '⏹' : '🎤'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div>
            <div style={{ 
              background: activeSOS.status === 'pending' ? '#110000' : 
                        activeSOS.status === 'accepted' ? '#001100' : 
                        activeSOS.status === 'responding' ? '#001a33' : '#111',
              border: activeSOS.status === 'pending' ? '1px solid #cc0000' : 
                     activeSOS.status === 'accepted' ? '1px solid #00cc44' : 
                     activeSOS.status === 'responding' ? '1px solid #0088ff' : '1px solid #444',
              borderRadius: '4px', 
              padding: '20px', 
              marginBottom: '20px',
              animation: 'pulse 2s infinite'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: activeSOS.status === 'pending' ? '#cc0000' : 
                                            activeSOS.status === 'accepted' ? '#00cc44' : 
                                            activeSOS.status === 'responding' ? '#0088ff' : '#888', 
                              letterSpacing: '4px', textTransform: 'uppercase' }}>
                  ● Active SOS — {activeSOS.category.replace('_', ' ')}
                </div>
                <div style={{ 
                  padding: '4px 12px', 
                  borderRadius: '12px', 
                  fontSize: '10px', 
                  letterSpacing: '2px', 
                  textTransform: 'uppercase',
                  background: activeSOS.status === 'pending' ? 'rgba(204,0,0,0.2)' : 
                             activeSOS.status === 'accepted' ? 'rgba(0,204,68,0.2)' : 
                             activeSOS.status === 'responding' ? 'rgba(0,136,255,0.2)' : 'rgba(68,68,68,0.2)',
                  color: activeSOS.status === 'pending' ? '#cc0000' : 
                         activeSOS.status === 'accepted' ? '#00cc44' : 
                         activeSOS.status === 'responding' ? '#0088ff' : '#888'
                }}>
                  {activeSOS.status}
                </div>
              </div>
              <div style={{ fontSize: '13px', color: '#555', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>
                {activeSOS.status === 'pending' && 'Searching for nearby volunteers...'}
                {activeSOS.status === 'accepted' && 'Volunteer on the way!'}
                {activeSOS.status === 'responding' && 'Volunteer responding to your location'}
              </div>

              {/* Anti-Ambush Rescue Verification Code */}
              {activeSOS.verificationCode && (
                <div style={{
                  background: '#0d180d',
                  border: '1px dashed #00cc44',
                  borderRadius: '4px',
                  padding: '12px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '10px', color: '#888', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '4px' }}>
                    🛡️ Anti-Ambush Safety Verification PIN
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#00cc44', letterSpacing: '8px' }}>
                    {activeSOS.verificationCode}
                  </div>
                  <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
                    Share this code with your responder in person to verify their official identity and safe arrival.
                  </div>
                </div>
              )}
              <button
                onClick={async () => {
                  const emergencyNumber = await getEmergencyNumber()
                  window.location.href = `tel:${emergencyNumber}`
                  await callEmergencyServices()
                }}
                style={{ width: '100%', padding: '12px', background: '#cc0000', border: 'none', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', marginBottom: '8px' }}
              >
                📞 Call Emergency Services
              </button>
              <button
                onClick={cancelSOS}
                style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #444', color: '#888', fontFamily: 'Oswald, sans-serif', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
              >
                Cancel SOS
              </button>

              {/* Nearby Hospitals */}
              {nearbyHospitals.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '11px', color: '#00cccc', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    🏥 Nearby Hospitals
                  </div>
                  {nearbyHospitals.slice(0, 3).map((hospital, i) => (
                    <div key={i} style={{ 
                      background: '#001a1a', 
                      border: '1px solid #00cccc', 
                      borderRadius: '4px', 
                      padding: '12px', 
                      marginBottom: '8px' 
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ fontSize: '13px', color: '#fff', letterSpacing: '1px', fontWeight: '600' }}>
                          {hospital.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#00cccc', letterSpacing: '2px' }}>
                          {hospital.distance} km
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#666', letterSpacing: '1px', marginBottom: '8px' }}>
                        {hospital.address}
                      </div>
                      <button
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`, '_blank')}
                        style={{ width: '100%', padding: '8px', background: '#00cccc', border: 'none', color: '#000', fontFamily: 'Oswald, sans-serif', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
                      >
                        Navigate
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#555', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Live Location
              </div>
              <SOSMap
                victimLocation={victimLocation}
                volunteerLocation={volunteerLocation}
              />
            </div>

            <AIAssistant
              category={activeSOS.category}
              description={activeSOS.description}
              language={selectedLanguage}
            />

            {activeSOS.assignedVolunteer && (
              <div style={{ marginTop: '20px' }}>
                <ChatBox
                  sosId={activeSOS._id}
                  partnerName={activeSOS.assignedVolunteer?.name}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mobile-p-20" style={{ flex: 1, padding: '48px', overflowY: 'auto' }}>
        <div style={S.tag}>Activity Log</div>
        <div style={{ fontSize: '22px', fontWeight: '600', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '24px' }}>
          Past Requests
        </div>

        {history.length === 0 ? (
          <div style={{ color: '#333', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', textAlign: 'center', marginTop: '60px', lineHeight: '2' }}>
            No activity yet.<br />Your SOS history will appear here.
          </div>
        ) : (
          history.map((h, i) => (
            <div key={i} style={{ background: '#111', border: '1px solid #1c1c1c', borderRadius: '4px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '15px', color: '#fff', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  {h.category.replace('_', ' ')}
                </div>
                <div style={{ fontSize: '11px', color: h.status === 'completed' ? '#00cc44' : h.status === 'cancelled' ? '#666' : '#cc0000', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  {h.status}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#444', letterSpacing: '2px', marginTop: '6px' }}>
                {new Date(h.createdAt).toLocaleString()}
              </div>
              {h.aiAnalysis?.summary && (
                <div style={{ fontSize: '12px', color: '#555', marginTop: '8px', letterSpacing: '1px' }}>
                  {h.aiAnalysis.summary}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── MAIN VICTIM PAGE ─────────────────────────────────────────
export default function Victim() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#cc0000', fontSize: '13px', letterSpacing: '4px', textTransform: 'uppercase' }}>Loading...</div>
    </div>
  )

  if (user && user.role === 'volunteer') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Oswald, sans-serif' }}>
        <nav style={S.nav}>
          <div style={S.logo}><span style={{ color: '#cc0000' }}>&#9675;</span> Emergency SOS</div>
          <div style={S.navLinks}>
            <span onClick={() => navigate('/')} style={S.navLink}>Home</span>
            <span style={S.navActive}>Victim</span>
            <span onClick={() => navigate('/volunteer')} style={S.navLink}>Volunteer</span>
          </div>
        </nav>
        <div style={S.redBar} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 57px)', textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '11px', color: '#cc0000', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: '16px' }}>Access Denied</div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
            You're a Volunteer,<br /><span style={{ color: '#cc0000' }}>Not a Victim.</span>
          </div>
          <div style={{ fontSize: '14px', color: '#555', letterSpacing: '2px', marginBottom: '32px' }}>
            You can't send an SOS and respond to it yourself. That's not how this works.
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => navigate('/volunteer')}
              style={{ padding: '14px 30px', background: '#cc0000', border: 'none', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: '13px', letterSpacing: '4px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}
            >
              Go to Volunteer Dashboard
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
          <span style={S.navActive}>Victim</span>
          <span onClick={() => navigate('/volunteer')} style={S.navLink}>Volunteer</span>
        </div>
      </nav>
      <div style={S.redBar} />

      {!user ? (
        <div className="mobile-stack" style={S.body}>
          <div className="mobile-p-20" style={S.left}>
            <div style={S.tag}>Emergency SOS</div>
            <div className="mobile-title" style={S.title}>I Need<br /><span style={S.titleRed}>Help.</span></div>
            <div style={S.desc}>Enter your phone number to get started. New users register automatically. Existing users sign in directly.</div>
          </div>
          <div className="mobile-p-20" style={S.right}>
            <LoginForm />
          </div>
        </div>
      ) : (
        <SOSDashboard />
      )}
    </div>
  )
}