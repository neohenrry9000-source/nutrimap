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

# Exponer el puerto (por defecto Flask usa 5000)
EXPOSE 5000

# Comando para arrancar la aplicación
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--timeout", "120", "app:app" ] # nosec B104