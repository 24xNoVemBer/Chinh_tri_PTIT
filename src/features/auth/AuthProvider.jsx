import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, jsonBody } from '../../services/api/client'
import { AuthContext } from './AuthContext'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  const refreshSession = useCallback(async () => {
    setStatus('loading')
    try {
      const authenticatedUser = await apiRequest('/api/auth/me')
      setUser(authenticatedUser)
      setStatus('authenticated')
      return authenticatedUser
    } catch (error) {
      if (error.status !== 401) console.error(error)
      setUser(null)
      setStatus('anonymous')
      return null
    }
  }, [])

  useEffect(() => {
    let active = true
    apiRequest('/api/auth/me')
      .then((authenticatedUser) => {
        if (!active) return
        setUser(authenticatedUser)
        setStatus('authenticated')
      })
      .catch((error) => {
        if (!active) return
        if (error.status !== 401) console.error(error)
        setUser(null)
        setStatus('anonymous')
      })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const authenticatedUser = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: jsonBody({ email, password }),
    })
    setUser(authenticatedUser)
    setStatus('authenticated')
    return authenticatedUser
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo(
    () => ({
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      login,
      logout,
      refreshSession,
      status,
      user,
    }),
    [login, logout, refreshSession, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
