import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Panel from "./pages/Panel.jsx";
import Admin from "./pages/Admin.jsx";
import { useAuth } from "./hooks/useAuth.jsx";

export default function App() {
  const { rol } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={rol ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={rol ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/panel" element={rol ? <Panel /> : <Navigate to="/login" />} />
      {/* La ruta solo se monta con rol admin; la autorización real la
          impone el backend (require_role) en cada endpoint /api/admin */}
      <Route path="/admin" element={rol === "admin" ? <Admin /> : <Navigate to="/" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
