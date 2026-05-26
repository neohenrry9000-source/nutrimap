import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Navbar() {
  const { isAuth, rol, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '56px',
      borderBottom: '1px solid #e5e7eb',
      background: '#fff',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <span style={{ fontWeight: 600, fontSize: '18px', color: '#1D9E75' }}>
          NutriMap
        </span>
      </Link>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {isAuth ? (
          <>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              {rol}
            </span>
            <button onClick={handleLogout} style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              background: 'none',
              cursor: 'pointer',
              fontSize: '13px',
            }}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link to="/login">
            <button style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#1D9E75',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
            }}>
              Iniciar sesión
            </button>
          </Link>
        )}
      </div>
    </nav>
  )
}

export default Navbar