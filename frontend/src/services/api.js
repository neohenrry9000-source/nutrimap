// Capa única para hablar con la API. NO se almacena ni JWT ni datos
// sensibles en localStorage permanente: usamos sessionStorage para
// que se invalide al cerrar pestaña (mejor postura para una demo).
const BASE = import.meta.env.VITE_API_URL || "/api";

export function getRol() { return sessionStorage.getItem("nm_rol"); }
export function setRol(r) {
  if (r) sessionStorage.setItem("nm_rol", r);
  else   sessionStorage.removeItem("nm_rol");
}

async function req(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };

  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || `HTTP ${r.status}`);
    err.status = r.status;
    err.detail = data.detail;
    throw err;
  }
  return data;
}

export const api = {
  register: (b) => req("/register", { method: "POST", body: b, auth: false }),
  login:    (b) => req("/login",    { method: "POST", body: b, auth: false }),
  mapa:     ()  => req("/mapa", { auth: false }),
  orgs:     (ub)=> req(`/organizaciones${ub ? `?ubigeo=${ub}` : ""}`, { auth: false }),
  miOrg:    ()  => req("/mi-organizacion"),
  updMiOrg: (b) => req("/mi-organizacion", { method: "PUT", body: b }),
  donar:    (b) => req("/donar",  { method: "POST", body: b }),
  logout:   ()  => req("/logout", { method: "POST" }),
};
