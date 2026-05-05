# NutriMap

NutriMap es una aplicación web orientada a visualizar indicadores de riesgo nutricional infantil y brechas de apoyo estatal a ollas comunes y comedores populares en el Perú. La solución busca facilitar la priorización territorial de recursos mediante mapas interactivos, gráficos y filtros por departamento o distrito.

## Stack tecnológico

### Frontend
- React
- Vite
- JavaScript / TypeScript
- Tailwind CSS

### Visualización de datos
- React Leaflet para mapas interactivos
- Recharts para gráficos estadísticos
- Archivos JSON generados a partir de datos en Excel

### Calidad, seguridad y CI/CD
- Git y GitHub para control de versiones
- Pull Requests obligatorios para integrar cambios
- GitHub Actions para CI/CD
- Vitest y React Testing Library para pruebas
- npm audit, Dependabot y CodeQL para revisión de seguridad

### Despliegue
- Vercel o Netlify para publicación del frontend

## Justificación del stack

React permite construir una interfaz modular, escalable y reutilizable para representar mapas, indicadores y gráficos. Vite facilita un entorno de desarrollo rápido y liviano. React Leaflet permite integrar mapas interactivos, mientras que Recharts facilita la visualización de indicadores nutricionales. Este stack permite desarrollar primero una versión funcional del sistema y luego evolucionar hacia una arquitectura más completa con backend y base de datos geoespacial.

## Evolución futura

En una segunda etapa, NutriMap podrá incorporar un backend con Node.js o FastAPI, junto con una base de datos PostgreSQL/PostGIS para manejar información territorial, histórica y georreferenciada.
