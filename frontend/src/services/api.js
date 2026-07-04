// Capa única para hablar con la API. NO se almacena ni JWT ni datos
// sensibles en localStorage permanente: usamos sessionStorage para
// que se invalide al cerrar pestaña (mejor postura para una demo).
const BASE = import.meta.env.VITE_API_URL || "/api";

export function getRol() { return sessionStorage.getItem("nm_rol"); }
export function setRol(r) {
  if (r) sessionStorage.setItem("nm_rol", r);
  else   sessionStorage.removeItem("nm_rol");
}

export function setToken(tk) {
  if (tk) sessionStorage.setItem("nm_token", tk);
  else    sessionStorage.removeItem("nm_token");
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
  logout:   ()  => req("/logout",   { method: "POST" }),
  me:       ()  => req("/me"),
  updPerfil:(b) => req("/mi-perfil", { method: "PUT", body: b }),
  mapa:     ()  => req("/mapa", { auth: false }),
  orgs:     (ub)=> req(`/organizaciones${ub ? `?ubigeo=${ub}` : ""}`, { auth: false }),
  crearOrg: (b) => req("/organizaciones", { method: "POST", body: b }),
  miOrg:    ()  => req("/mi-organizacion"),
  updMiOrg: (b) => req("/mi-organizacion", { method: "PUT", body: b }),
  orgDonaciones: () => req("/mi-organizacion/donaciones"),
  donar:    (b) => req("/donar", { method: "POST", body: b }),
  confirmarDonacion: (id) => req(`/donaciones/${id}/confirmar`, { method: "POST" }),
  misDonaciones: () => req("/mis-donaciones"),
  // Feed, métricas y metas (públicos)
  feed:     ()  => req("/feed", { auth: false }),
  stats:    ()  => req("/stats", { auth: false }),
  metas:    ()  => req("/metas", { auth: false }),
  topOrgs:  ()  => req("/organizaciones/top", { auth: false }),
  // Finanzas de la organización
  finanzas: ()  => req("/mi-organizacion/finanzas"),
  retiros:  ()  => req("/mi-organizacion/retiros"),
  solicitarRetiro: (b) => req("/mi-organizacion/retiros", { method: "POST", body: b }),
  guardarMeta: (b) => req("/mi-organizacion/meta", { method: "POST", body: b }),
  // Avatares
  subirAvatar:    (b) => req("/mi-avatar", { method: "POST", body: b }),
  subirAvatarOrg: (b) => req("/mi-organizacion/avatar", { method: "POST", body: b }),
  // Métodos de cobro (solo org dueña / admin)
  metodosCobro:       ()      => req("/mi-organizacion/metodos-cobro"),
  crearMetodoCobro:   (b)     => req("/mi-organizacion/metodos-cobro", { method: "POST", body: b }),
  editarMetodoCobro:  (id, b) => req(`/mi-organizacion/metodos-cobro/${id}`, { method: "PUT", body: b }),
  borrarMetodoCobro:  (id)    => req(`/mi-organizacion/metodos-cobro/${id}`, { method: "DELETE" }),
  // Admin
  adminResumen:      ()        => req("/admin/resumen"),
  adminRetiros:      (estado)  => req(`/admin/retiros${estado ? `?estado=${estado}` : ""}`),
  adminAccionRetiro: (id, b)   => req(`/admin/retiros/${id}`, { method: "POST", body: b }),
  // Admin · moderación
  adminUsuarios: (p = {}) =>
    req(`/admin/usuarios?${new URLSearchParams(p)}`),
  adminOrganizaciones: (p = {}) =>
    req(`/admin/organizaciones?${new URLSearchParams(p)}`),
  adminModerar: (b) => req("/admin/moderar", { method: "POST", body: b }),
  adminHistorialModeracion: (tipo, id) => req(`/admin/moderacion/${tipo}/${id}`),
};
