# Usar imagen ligera de Python 3.11
FROM python:3.11-slim

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar el archivo de dependencias primero
COPY requirements.txt .

# Instalar las dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo el resto del código del backend al contenedor
COPY . .

# Exponer el puerto por defecto (Render inyecta PORT en runtime)
EXPOSE 8080

# Forma shell para expandir $PORT (Render lo define; local usa 8080)
CMD gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 120 app:app