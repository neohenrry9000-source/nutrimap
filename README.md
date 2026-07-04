# NutriMap 🇵🇪

Plataforma web que cruza datos oficiales de anemia infantil (ENDES 2024 / INEI) con la cobertura de comedores populares, visualiza el riesgo nutricional en un mapa interactivo del Perú y conecta donantes con ollas comunes y comedores en las zonas más críticas.

Proyecto del curso **Arquitectura de Aplicaciones Seguras**.

## Funcionalidades

- 🗺️ Mapa coroplético por departamento con 917 distritos (riesgo por anemia, cobertura de comedores, oferta social ENDES), ranking, comparador, favoritos y modo presentación.
- 💚 Donaciones con tarjeta o **Yape**, opción de **donación anónima**, comprobante descargable y feed de actividad en tiempo real (Supabase Realtime).
- 🏠 Panel de organización: perfil completo (RUC, contacto, cobertura), metas de recaudación, finanzas (recaudado/retirado/disponible), **retiros de fondos** y métodos de cobro.
- 🏅 Panel de donador: historial, niveles con medallas (Semilla → Diamante) y avatar.
- 🛡️ Panel de administración: aprobación de retiros con trazabilidad, métricas globales y **moderación** (suspender/banear usuarios y organizaciones con historial auditable).
- 🌙 Tema claro/oscuro.

## Estructura

```
nutrimap/
├── pipeline/    # ETL ENDES: build_mapa.py y build_oferta_social.py
├── sql/         # Migraciones para Supabase (ejecutar en orden, ver abajo)
├── backend/     # Flask + JWT + Argon2 + Supabase (tests con 91% coverage)
├── frontend/    # React + Vite + Tailwind + react-leaflet
└── render.yaml  # Blueprint de despliegue en Render
```

## Puesta en marcha local

**Requisitos:** Python 3.11+, Node 20+, un proyecto de Supabase.

**1. Base de datos** — en el SQL Editor de Supabase, ejecutar en orden:
`sql/schema.sql` → `sql/migracion_endes_mapa_2024.sql` → `sql/mejoras_negocio.sql` → `sql/evolucion_producto.sql` → `sql/fase_admin.sql` → `sql/fase_moderacion.sql`.

**2. Datos** (CSVs oficiales ENDES en la raíz o en `data/`):

```bash
cd pipeline && pip install -r requirements.txt
python build_mapa.py                    # mapa de riesgo (917 distritos)
python build_oferta_social.py --load    # comedores ENDES -> Supabase
```

**3. Backend:**

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env      # completar claves de Supabase
python app.py             # http://localhost:8080
```

**4. Frontend:**

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173 (proxy /api -> :8080)
```

## Tests y coverage

```bash
cd backend
pip install -r requirements-dev.txt
pytest                                              # 156 tests
pytest --cov=. --cov-report=html --cov-fail-under=80  # coverage (~91%)
```

La suite usa un doble de Supabase en memoria (`tests/conftest.py`): corre sin red y sin tocar la base real. El CI (GitHub Actions) ejecuta bandit + la suite con umbral de 80%.

## Despliegue en Render

La rama de despliegue es **`jeiner-gutierrez-v2`**. `render.yaml` define ambos servicios; también puede configurarse a mano en el dashboard con los mismos valores:

| | Backend | Frontend |
|---|---|---|
| Tipo | Web Service (Python) | Static Site |
| Branch | `jeiner-gutierrez-v2` | `jeiner-gutierrez-v2` |
| Root Directory | `backend` | `frontend` |
| Build | `pip install -r requirements.txt` | `npm ci && npm run build` |
| Start / Publish | `gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 app:app` | `dist` + rewrite `/* → /index.html` |

Variables de entorno: ver `backend/.env.example` y `frontend/.env.example`. En producción `CORS_ORIGINS` debe ser la URL exacta del frontend y `VITE_API_URL` la del backend (`https://.../api`).

## Controles de seguridad

| Control | Dónde |
|---|---|
| Argon2id para passwords · JWT HS256 (2h) | `backend/services/security.py` |
| Rate limiting (estricto en `/login`) | `backend/routes/auth.py` |
| Validación Pydantic de todo input | `backend/validators/schemas.py` |
| CORS restrictivo + verificación de Origin | `backend/app.py`, `middleware/` |
| Headers OWASP y errores sin stack trace | `backend/middleware/`, `app.py` |
| RLS en todas las tablas (datos financieros solo backend) | `sql/*.sql` |
| Sin almacenar PAN/CVV (referencia SHA-256) | `backend/routes/donaciones.py` |
| Anonimato de donante aplicado en servidor | `routes/donaciones.py`, `organizaciones.py` |
| Anti-sobregiro de retiros (app + trigger en BD) | `services/finanzas.py`, `sql/evolucion_producto.sql` |
| Moderación auditable (nada se borra) | `routes/admin.py`, `sql/fase_moderacion.sql` |
| Auditoría de logins y acciones admin | `intentos_login`, `auditoria_eventos` |
| SAST (bandit) + tests con umbral 80% en CI | `.github/workflows/ci.yml` |

## Limitaciones conocidas

1. ENDES no garantiza representatividad distrital: muestras `n < 5` se marcan `SIN_DATOS`.
2. Los nombres de distrito usan la localidad referencial ENDES; el padrón completo de UBIGEOS del INEI queda como mejora.
3. Los pagos (tarjeta/Yape) no mueven dinero real; la arquitectura cumple PCI-DSS por construcción al no persistir datos sensibles.
4. Auth propia autocontenida; para producción a escala se recomienda migrar a Supabase Auth.
