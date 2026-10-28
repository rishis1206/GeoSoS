import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/useAuth'
import api from '../services/api'

export default function ChatBox({ sosId, partnerName, isPending }) {
  const { user, socket } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [typingNotice, setTypingNotice] = useState('')
  const bottomRef = useRef(null)
  const chatContainerRef = useRef(null)
  const prevCountRef = useRef(0)
  const typingTimerRef = useRef(null)

  const cleanSosId = typeof sosId === 'object' && sosId?._id ? String(sosId._id) : String(sosId || '')

  // 1. Initial message fetch + 2-second cache-busted polling fallback
  useEffect(() => {
    if (!cleanSosId) return

    let isMounted = true
    const fetchMessages = () => {
      api.get(`/messages/${cleanSosId}`, { params: { _t: Date.now() } })
        .then(res => {
          if (isMounted && res.data.messages) {
            setMessages(res.data.messages)
          }
        })
        .catch(err => {
          console.warn('Chat fetch warning:', err.message)
        })
    }

    fetchMessages()
    const interval = setInterval(fetchMessages, 2000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [cleanSosId])

  // 2. Real-time Socket.io room & message handling
  useEffect(() => {
    if (!socket || !cleanSosId) return

    socket.emit('join_sos_room', cleanSosId)

    const handleNewMessage = (msg) => {
      const msgSosId = msg.sosId?._id || msg.sosId
      if (String(msgSosId) === String(cleanSosId)) {
        setMessages(prev => {
          const exists = prev.some(m => String(m._id) === String(msg._id))
          if (exists) return prev
          return [...prev, msg]
        })
      }
    }

    const handleUserTyping = (data) => {
      if (data?.name && data.name !== user?.name && data.isTyping) {
        setTypingNotice(`${data.name} is typing...`)
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
        typingTimerRef.current = setTimeout(() => setTypingNotice(''), 2500)
      } else if (!data?.isTyping) {
        setTypingNotice('')
      }
    }

    socket.on('new_message', handleNewMessage)
    socket.on('chat_message_received', handleNewMessage)
    socket.on('user_typing', handleUserTyping)

    return () => {
      socket.emit('leave_sos_room', cleanSosId)
      socket.off('new_message', handleNewMessage)
      socket.off('chat_message_received', handleNewMessage)
      socket.off('user_typing', handleUserTyping)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    }
  }, [socket, cleanSosId, user?.name])

  // Scroll ONLY the internal chat container, never the window or outer dashboard
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }
      prevCountRef.current = messages.length
    }
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || !cleanSosId) return
    setLoading(true)
    setError('')
    const messageText = input.trim()

    try {
      const res = await api.post('/messages', {
        sosId: cleanSosId,
        message: messageText
      })

      const newMsg = res.data.message
      if (newMsg) {
        setMessages(prev => {
          const exists = prev.some(m => String(m._id) === String(newMsg._id))
          if (exists) return prev
          return [...prev, newMsg]
        })
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          })
        }
      }
      setInput('')
      if (socket) {
        socket.emit('typing', { sosId: cleanSosId, isTyping: false })
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setError(err.response?.data?.message || 'Failed to send message. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  const handleTyping = (e) => {
    const val = e.target.value
    setInput(val)
    if (socket && cleanSosId) {
      socket.emit('typing', { sosId: cleanSosId, isTyping: val.length > 0 })
    }
  }

  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #1c1c1c', borderRadius: '4px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#cc0000', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
          ✦ Emergency Chat {partnerName ? `• ${partnerName}` : ''}
        </div>
        <div style={{ fontSize: '10px', color: '#00cc44', letterSpacing: '1px', textTransform: 'uppercase' }}>
          ● Live Encrypted Channel
        </div>
      </div>

      {isPending && (
        <div style={{ background: '#141400', border: '1px solid #444400', borderRadius: '3px', padding: '8px 12px', marginBottom: '12px', fontSize: '11px', color: '#ddaa00', letterSpacing: '1px' }}>
          📡 Awaiting responder connection... Any updates or details you send here will be visible to nearby responders immediately.
        </div>
      )}

      {error && (
        <div style={{ background: '#1a0000', border: '1px solid #cc0000', borderRadius: '3px', padding: '8px 12px', marginBottom: '12px', fontSize: '11px', color: '#ff4444', letterSpacing: '1px' }}>
          {error}
        </div>
      )}

      <div
        ref={chatContainerRef}
        style={{ height: '220px', overflowY: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px' }}
      >
        {messages.length === 0 ? (
          <div style={{ color: '#333', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center', marginTop: '80px' }}>
            No messages yet
          </div>
        ) : (
          messages.map((msg, i) => {
            const rawSender = msg.senderId?._id || msg.senderId?.id || msg.senderId
            const myId = user?._id || user?.id
            const isMe = (myId && String(rawSender) === String(myId)) ||
                         (user?.role && msg.senderId?.role && msg.senderId.role === user.role)
            const senderDisplayName = msg.senderId?.name ||
              (user?.role === 'victim' ? (partnerName || 'Volunteer Responder') : (partnerName || 'Citizen in Distress'))

            return (
              <div key={msg._id || i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  padding: '8px 14px',
                  borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  background: isMe ? '#cc0000' : '#1a1a1a',
                  border: `1px solid ${isMe ? '#ff2222' : '#2a2a2a'}`,
                  maxWidth: '75%'
                }}>
                  {!isMe && (
                    <div style={{ fontSize: '10px', color: '#00cc44', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold' }}>
                      {senderDisplayName}
                    </div>
                  )}
                  <div style={{ fontSize: '13px', color: '#fff', letterSpacing: '0.5px', lineHeight: '1.5' }}>
                    {msg.message}
                  </div>
                  <div style={{ fontSize: '10px', color: isMe ? '#ffaaaa' : '#555', letterSpacing: '1px', marginTop: '4px', textAlign: isMe ? 'right' : 'left' }}>
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            )
          })
        )}
        {typingNotice && (
          <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', paddingLeft: '8px' }}>
            {typingNotice}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          style={{
            flex: 1,
            background: '#111',
            border: '1px solid #222',
            color: '#fff',
            padding: '10px 14px',
            fontFamily: 'Oswald, sans-serif',
            fontSize: '13px',
            borderRadius: '3px',
            outline: 'none'
          }}
          placeholder="Type a message..."
          value={input}
          onChange={handleTyping}
          onKeyDown={e => e.key === 'Enter' && !loading && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#cc0000',
            border: 'none',
            color: '#fff',
            fontFamily: 'Oswald, sans-serif',
            fontSize: '12px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            borderRadius: '3px'
          }}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}