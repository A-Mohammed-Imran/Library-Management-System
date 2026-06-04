import secrets
import time
from functools import wraps
from flask import request, jsonify

# In a real app, use a DB or Redis to store active tokens, or use JWT.
# For this internship-level app, we will use a simple in-memory dictionary.
# A token is generated on login and mapped to a tuple: (user_id, expiration_timestamp).
ACTIVE_TOKENS = {}
TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60  # 24 hours

def generate_token(user_id):
    token = secrets.token_hex(32)
    expiration = time.time() + TOKEN_EXPIRATION_SECONDS
    ACTIVE_TOKENS[token] = (user_id, expiration)
    return token

def revoke_token(token):
    if token in ACTIVE_TOKENS:
        del ACTIVE_TOKENS[token]

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "message": "Unauthorized"}), 401
        
        token = auth_header.split(" ")[1]
        
        if token not in ACTIVE_TOKENS:
            return jsonify({"success": False, "message": "Invalid token"}), 401
            
        user_id, expiration = ACTIVE_TOKENS[token]
        if time.time() > expiration:
            revoke_token(token)
            return jsonify({"success": False, "message": "Token expired"}), 401
            
        return f(*args, **kwargs)
    return decorated
