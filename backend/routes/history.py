from flask import Blueprint, jsonify
from db import get_db_connection

history_bp = Blueprint('history', __name__)

@history_bp.get("/")
def get_history():
    with get_db_connection() as connection:
        # Join with books table to get the title and author
        rows = connection.execute("""
            SELECT 
                br.id,
                br.borrower_name,
                br.borrow_date,
                br.return_date,
                br.status,
                b.title as book_title,
                b.author as book_author
            FROM borrow_records br
            JOIN books b ON br.book_id = b.id
            ORDER BY br.borrow_date DESC
            LIMIT 50
        """).fetchall()

    history_data = []
    for row in rows:
        history_data.append({
            "id": row["id"],
            "borrower_name": row["borrower_name"],
            "borrow_date": row["borrow_date"],
            "return_date": row["return_date"],
            "status": row["status"],
            "book_title": row["book_title"],
            "book_author": row["book_author"]
        })

    return jsonify({"success": True, "data": history_data})
