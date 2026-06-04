import os
from flask import Flask, jsonify
from flask_cors import CORS
from db import init_db

# Import blueprints
from routes.auth import auth_bp
from routes.books import books_bp
from routes.history import history_bp
from routes.dashboard import dashboard_bp

app = Flask(__name__)

# Keep CORS open by default for easy setup, then lock it in production with CORS_ORIGINS.
raw_origins = os.getenv("CORS_ORIGINS", "*").strip()
allowed_origins = "*" if raw_origins == "*" else [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

# Initialize database
init_db()

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(books_bp, url_prefix="/api/books")
app.register_blueprint(history_bp, url_prefix="/api/history")
app.register_blueprint(dashboard_bp, url_prefix="/api")

@app.get("/api/health")
def health_check():
    # Ultra-lightweight health endpoint: no DB access, no heavy work
    return jsonify({"success": True, "status": "healthy", "message": "Backend is running"}), 200

@app.errorhandler(404)
def handle_404(_):
    return jsonify({"success": False, "message": "Route not found."}), 404

@app.errorhandler(405)
def handle_405(_):
    return jsonify({"success": False, "message": "Method not allowed."}), 405

@app.errorhandler(500)
def handle_500(_):
    return jsonify({"success": False, "message": "Internal server error."}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug_mode = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug_mode)