import axios from 'axios'

export const API_ORIGIN = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('pages.dev')
    ? 'https://fast-days-sin.loca.lt'
    : typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `http://${window.location.hostname}:5000`
    : 'http://localhost:5000')
).replace(/\/$/, '')

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: {
    'bypass-tunnel-reminder': 'true',
  },
})

export function getActiveRole() {
  if (typeof window === 'undefined') return 'victim'
  const path = (window.location.pathname || '').toLowerCase()
  if (path.startsWith('/volunteer')) return 'volunteer'
  if (path.startsWith('/victim')) return 'victim'
  return null
}

export function getActiveToken() {
  if (typeof window === 'undefined') return null
  const role = getActiveRole()

  // 1. Tab-specific sessionStorage
  if (role) {
    const sRoleToken = sessionStorage.getItem(`token_${role}`)
    if (sRoleToken) return sRoleToken
  }
  const sGeneric = sessionStorage.getItem('token')
  const sStoredRole = sessionStorage.getItem('user_role')
  if (sGeneric && (!role || !sStoredRole || sStoredRole === role)) {
    return sGeneric
  }

  // 2. Role-scoped localStorage
  if (role) {
    const lRoleToken = localStorage.getItem(`token_${role}`)
    if (lRoleToken) return lRoleToken
  }

  // 3. Fallback to generic localStorage
  const lStoredRole = localStorage.getItem('userRole')
  if (!role || !lStoredRole || lStoredRole === role) {
    return localStorage.getItem('token')
  }

  return null
}

export function storeActiveSession(userData, userToken) {
  if (!userToken) return
  const role = userData?.role || getActiveRole() || 'victim'

  // Tab-isolated storage
  sessionStorage.setItem(`token_${role}`, userToken)
  sessionStorage.setItem('token', userToken)
  sessionStorage.setItem('user_role', role)
  if (userData) {
    sessionStorage.setItem(`user_${role}`, JSON.stringify(userData))
  }

  // Persistent cross-tab storage
  localStorage.setItem(`token_${role}`, userToken)
  localStorage.setItem('token', userToken)
  localStorage.setItem('userRole', role)
  if (userData) {
    localStorage.setItem(`user_${role}`, JSON.stringify(userData))
  }
}

export function clearActiveSession(role) {
  const targetRole = role || getActiveRole()
  if (targetRole) {
    sessionStorage.removeItem(`token_${targetRole}`)
    sessionStorage.removeItem(`user_${targetRole}`)
    localStorage.removeItem(`token_${targetRole}`)
    localStorage.removeItem(`user_${targetRole}`)
  }
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user_role')
  localStorage.removeItem('token')
  localStorage.removeItem('userRole')
}

api.interceptors.request.use((config) => {
  const token = getActiveToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
