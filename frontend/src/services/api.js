import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://nutrimap-dev.onrender.com/api',
})

API.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const register = (data) => API.post('/register', data)
export const login    = (data) => API.post('/login', data)
export const getMapa  = ()     => API.get('/mapa')
export const getOrgs  = ()     => API.get('/organizaciones')

export default API