import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home       from './pages/Home'
import LoginPage  from './pages/LoginPage'
import { useAuth } from './hooks/useAuth'

function App() {
  const { isAuth } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*"      element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App