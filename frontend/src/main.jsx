import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./hooks/useAuth.jsx";
import { applyStoredTheme } from "./hooks/useTheme.js";
import "./index.css";

// Aplica el tema antes del primer render para evitar flash claro/oscuro
applyStoredTheme();

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
