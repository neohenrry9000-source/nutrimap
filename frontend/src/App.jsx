import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { useAuth } from "./hooks/useAuth.js";

export default function App() {
  const { rol } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={rol ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={rol ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
