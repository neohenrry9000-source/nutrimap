from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/')
def index():
    return "NutriMap API - Sistema de Monitoreo de Anemia Activo", 200

# Esta es la ruta que tu Smoke Test está buscando
@app.route('/health')
def health():
    return jsonify({
        "status": "healthy",
        "service": "nutrimap-api",
        "environment": os.getenv("ENVIRONMENT", "development")
    }), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    # Usamos 0.0.0.0 para que Render/Docker puedan dirigir el tráfico
    app.run(host='0.0.0.0', port=port)  # nosec B104