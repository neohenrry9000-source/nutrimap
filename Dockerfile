FROM python:3.11-slim

# Metadata
LABEL maintainer="nutrimap-team"
LABEL version="1.0"

# Variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/src

# Dependencias primero (aprovecha cache de Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código (el .dockerignore filtra lo innecesario)
COPY . .

# ✅ Crear usuario no-root por seguridad
RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app

USER appuser

# ✅ Documentar el puerto
EXPOSE 8080

# ✅ Healthcheck para que Render detecte si la app falla
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

# Producción con gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--timeout", "120", "--graceful-timeout", "60", "src.app:app"]