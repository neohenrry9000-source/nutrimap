import { useState, useEffect } from 'react'

export function useAuth() {
  const [token, setToken]   = useState(localStorage.getItem('token'))
  const [rol, setRol]       = useState(localStorage.getItem('rol'))

  const loginUser = (token, rol) => {
    localStorage.setItem('token', token)
    localStorage.setItem('rol', rol)
    setToken(token)
    setRol(rol)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('rol')
    setToken(null)
    setRol(null)
  }

  return { token, rol, loginUser, logout, isAuth: !!token }
}