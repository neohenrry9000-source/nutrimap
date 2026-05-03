from flask import Flask, jsonify
import os

app = Flask(__name__)

# Ruta principal (opcional, para que veas algo al entrar al link)
@app.route('/')
def home():
    return "NutriMap API - Sistema de Monitoreo Activo", 200

# RUTA CRÍTICA: El Smoke Test de GitHub Actions busca esto exactamente
@app.route('/health')
def health():
    return jsonify({"status": "healthy"}), 200

if __name__ == "__main__":
    # Render asigna el puerto dinámicamente, por eso usamos os.environ
    port = int(os.environ.get("PORT", 8080))
    # El '# nosec B104' es para que Bandit no te dé el error de seguridad de nuevo
    app.run(host='0.0.0.0', port=port)  # nosec B104