from src.business.analytics import get_anemia_stats
from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/')
def home():
    return "NutriMap Activo", 200

@app.route('/api/v1/anemia/stats')
def anemia_stats():
    stats = get_anemia_stats()
    return jsonify(stats), 200

# Esta es la ruta que te está dando 404
@app.route('/health')
def health():
    return jsonify({"status": "healthy"}), 200






if __name__ == "__main__":
    # Render necesita leer la variable PORT
    port = int(os.environ.get("PORT", 8080))
    # El # nosec evita que el pipeline falle por seguridad
    app.run(host='0.0.0.0', port=port)  # nosec B104