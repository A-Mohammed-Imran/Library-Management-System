from flask import Blueprint, jsonify
from db import get_db_connection

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.get("/stats")
def get_stats():
    with get_db_connection() as connection:
        stats = connection.execute("""
            SELECT
                COUNT(*) AS total_books,
                SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_books,
                SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) AS issued_books
            FROM books
        """).fetchone()

    return jsonify({
        "success": True,
        "data": {
            "total_books": stats["total_books"] or 0,
            "available_books": stats["available_books"] or 0,
            "issued_books": stats["issued_books"] or 0,
        }
    })
