from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from db import get_db_connection
from utils import generate_token, revoke_token, require_auth

auth_bp = Blueprint('auth', __name__)

@auth_bp.post("/login")
def login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400

    with get_db_connection() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

    token = generate_token(user["id"])
    return jsonify({
        "success": True,
        "message": "Login successful",
        "data": {
            "token": token,
            "username": user["username"]
        }
    })

@auth_bp.post("/logout")
@require_auth
def logout():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        revoke_token(token)
    return jsonify({"success": True, "message": "Logged out successfully"})
