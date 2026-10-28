import { useEffect, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import api, {
  API_ORIGIN,
  getActiveToken,
  getActiveRole,
  storeActiveSession,
  clearActiveSession
} from '../services/api'
import { AuthContext } from './useAuth'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_ORIGIN

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getActiveToken())
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getActiveToken()))
  const [socket, setSocket] = useState(null)

  // Sync token whenever role context changes in URL or on mount
  const syncTokenFromLocation = useCallback(() => {
    const currentActiveToken = getActiveToken()
    if (currentActiveToken !== token) {
      setToken(currentActiveToken)
      if (currentActiveToken) {
        setLoading(true)
      } else {
        setUser(null)
        setLoading(false)
      }
    }
  }, [token])

  useEffect(() => {
    window.addEventListener('popstate', syncTokenFromLocation)
    return () => window.removeEventListener('popstate', syncTokenFromLocation)
  }, [syncTokenFromLocation])

  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    api.get('/auth/me')
      .then(res => {
        if (!cancelled) {
          setUser(res.data.user)
          storeActiveSession(res.data.user, token)
        }
      })
      .catch((err) => {
        console.warn('Auth check error:', err.message)
        clearActiveSession()
        if (!cancelled) {
          setToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const currentUserId = user?._id || user?.id

  useEffect(() => {
    if (!currentUserId || !token) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
      return
    }

    const nextSocket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    })

    nextSocket.on('connect', () => {
      setSocket(nextSocket)
      console.log(`🔌 Socket connected for ${user.name} (${user.role})`)
    })

    nextSocket.on('disconnect', () => {
      console.log('🔌 Socket disconnected')
    })

    return () => {
      nextSocket.disconnect()
    }
  }, [currentUserId, token])

  const login = (userData, userToken) => {
    storeActiveSession(userData, userToken)
    setToken(userToken)
    setUser(userData)
    setLoading(false)
  }

  const logout = () => {
    clearActiveSession(user?.role)
    setToken(null)
    setUser(null)
    setLoading(false)
    socket?.disconnect()
    setSocket(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, socket, syncTokenFromLocation }}>
      {children}
    </AuthContext.Provider>
  )
}
