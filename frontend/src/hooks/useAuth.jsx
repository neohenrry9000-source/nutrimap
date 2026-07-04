import { useState, useContext, createContext } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [rol, setR] = useState(() => sessionStorage.getItem("nm_rol"));

  const login = (r) => {
    sessionStorage.setItem("nm_rol", r);
    setR(r);
  };

  const logout = () => {
    sessionStorage.removeItem("nm_rol");
    setR(null);
  };

  return (
    <AuthContext.Provider value={{ isAuth: !!rol, rol, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);