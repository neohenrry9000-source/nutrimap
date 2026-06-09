# NutriMap

Plataforma web segura que cruza datos oficiales de anemia infantil (ENDES 2024 / INEI) con cobertura de comedores populares, visualiza el riesgo nutricional en un mapa del Perú y conecta donantes con ollas comunes / comedores populares en zonas críticas.

Curso: **Arquitectura de Aplicaciones Seguras**.

---

## Estructura

```
nutrimap/
├── pipeline/        # Python + pandas: procesa ENDES -> data_mapa_limpia.json
├── sql/             # schema.sql para Supabase (RLS incluido)
├── backend/         # Flask + JWT + Argon2 + Supabase
├── frontend/        # React + Tailwind + react-leaflet
└── .github/workflows/main.yml   # CI/CD (deploy auto a Render)
```

---

## 1. Pipeline ENDES

```bash
cd pipeline
pip install -r requirements.txt
# coloca los CSV oficiales en ../data/
#   RECH0_2024.csv  REC44_2024.csv  PS_COMEDOR_2024.csv
python build_mapa.py
# salida: ../data/out/data_mapa_limpia.{json,csv}
```

Probado con los CSVs que adjuntaste: **917 distritos procesados**.

Carga del resultado a Supabase:

```bash
psql "$SUPABASE_DB_URL" -f ../sql/schema.sql
psql "$SUPABASE_DB_URL" -c "\copy public.mapa_riesgo(ubigeo,departamento,provincia,distrito,total_ninos,casos_anemia,porcentaje_anemia,tiene_cobertura_comedor,cobertura_comedor_pct,nivel_riesgo,color_mapa,lat,lng) from '../data/out/data_mapa_limpia.csv' csv header"
```

---

## 2. Backend Flask

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # edita las claves
flask --app app run        # http://localhost:8000
```

---

## 3. Frontend React

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

El proxy de Vite redirige `/api` a Flask.

---

## 4. Deploy

`git push origin main` ⇒ GitHub Actions corre lint + SAST (bandit) + build + dispara deploy en Render. No hay aprobaciones manuales.

Para que el deploy automático funcione tienes que configurar 4 secretos en GitHub:

| Secret | Origen |
|---|---|
| `RENDER_SERVICE_ID_BACKEND` | URL del servicio en Render (parte `srv-XXX`) |
| `RENDER_DEPLOY_KEY_BACKEND` | Render → Service → Settings → Deploy Hook |
| `RENDER_SERVICE_ID_FRONTEND` | idem |
| `RENDER_DEPLOY_KEY_FRONTEND` | idem |

**Importante**: si todavía pide 2 aprobaciones, no viene del YAML — viene del *Environment* "production" en GitHub. Para apagarlo:

> Repo → **Settings → Environments → production → Required reviewers → off** (o elimina el environment).

El workflow de este repo **no** referencia `environment:` para evitar ese gate.

---

## Controles de seguridad aplicados

| Control | Dónde |
|---|---|
| Argon2id password hashing | `backend/services/security.py` |
| JWT HS256 con expiración 2h | `backend/services/security.py` |
| Rate limit 5/min en `/login` | `backend/routes/auth.py` |
| Validación Pydantic en todos los inputs | `backend/validators/schemas.py` |
| CORS restringido a origins explícitos | `backend/app.py` |
| Headers OWASP (CSP, X-Frame, HSTS…) | `backend/middleware/security_headers.py` |
| Manejo de error sin stack trace | `backend/app.py` |
| RLS en todas las tablas | `sql/schema.sql` |
| Auditoría de intentos de login | `sql/schema.sql` + `routes/auth.py` |
| Sin almacenar PAN/CVV (PCI-DSS) | `routes/donaciones.py` |
| Tokenización SHA-256 de la referencia | `routes/donaciones.py` |
| CSP en frontend | `frontend/index.html` |
| Token en sessionStorage (no localStorage) | `frontend/services/api.js` |
| SAST (bandit) en CI | `.github/workflows/main.yml` |

---

## Limitaciones declaradas (para defender en el informe)

1. **Tamaño de muestra**: ENDES no garantiza representatividad estadística a nivel distrital para todos los distritos. Distritos con `n < 5` se marcan `SIN_DATOS` en lugar de inventar un nivel.
2. **Provincia/distrito por nombre**: el pipeline deja los códigos UBIGEO. Para mostrar nombres legibles, cruza con el padrón oficial de UBIGEOS del INEI (`ubigeos.csv`).
3. **GeoJSON de polígonos distritales**: no se incluye en este repo por tamaño. Fallback: el mapa renderiza CircleMarkers usando lat/lng de la mediana del conglomerado por distrito. Para polígonos descarga el GeoJSON distrital del Perú (p.ej. el de GeoIDEP / juaneladio) y pásalo a `<MapView geojson={...} />`.
4. **Donaciones DEMO**: no procesa pagos reales. Cumple PCI-DSS por construcción (no se persisten datos sensibles).
5. **Auth propia vs Supabase Auth**: el código implementa auth propia para que sea autocontenida en la demo. En producción se recomienda Supabase Auth (rotación de claves, recovery, OAuth) y eliminar `password_hash`.
