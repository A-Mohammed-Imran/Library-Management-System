import html
from flask import Blueprint, request, jsonify
from db import get_db_connection
from utils import require_auth

books_bp = Blueprint('books', __name__)

def book_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "author": row["author"],
        "status": row["status"],
    }

def error_response(message, status_code=400):
    return jsonify({"success": False, "message": message}), status_code

@books_bp.get("/")
def get_books():
    query = request.args.get("query", "").strip()
    status_filter = request.args.get("status", "").strip()

    with get_db_connection() as connection:
        sql = "SELECT * FROM books WHERE 1=1"
        params = []
        
        if query:
            # Search by title or author
            sql += " AND (title LIKE ? OR author LIKE ?) COLLATE NOCASE"
            params.extend([f"%{query}%", f"%{query}%"])
            
        if status_filter in ("available", "issued"):
            sql += " AND status = ?"
            params.append(status_filter)
            
        sql += " ORDER BY id DESC"
        rows = connection.execute(sql, params).fetchall()

    return jsonify({"success": True, "data": [book_to_dict(row) for row in rows]})

@books_bp.post("/")
@require_auth
def add_book():
    payload = request.get_json(silent=True) or {}
    title = html.escape(str(payload.get("title", "")).strip())
    author = html.escape(str(payload.get("author", "")).strip())

    if not title or not author:
        return error_response("Title and author are required.", 400)
    if len(title) > 120 or len(author) > 120:
        return error_response("Title and author must be 120 characters or less.", 400)

    with get_db_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO books (title, author, status) VALUES (?, ?, 'available')",
            (title, author),
        )
        book_id = cursor.lastrowid
        connection.commit()
        
        row = connection.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()

    return jsonify({"success": True, "message": "Book added successfully.", "data": book_to_dict(row)}), 201

@books_bp.patch("/<int:book_id>/issue")
@require_auth
def issue_book(book_id):
    payload = request.get_json(silent=True) or {}
    borrower_name = html.escape(str(payload.get("borrower_name", "")).strip())
    
    if not borrower_name:
        return error_response("Borrower name is required.", 400)

    with get_db_connection() as connection:
        row = connection.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
        if not row:
            return error_response("Book not found.", 404)
        if row["status"] == "issued":
            return error_response("Book is already issued.", 400)

        # Update book status
        connection.execute("UPDATE books SET status = 'issued' WHERE id = ?", (book_id,))
        # Insert borrow record
        connection.execute(
            "INSERT INTO borrow_records (book_id, borrower_name, status) VALUES (?, ?, 'active')",
            (book_id, borrower_name)
        )
        connection.commit()

    return jsonify({"success": True, "message": "Book issued successfully."})

@books_bp.patch("/<int:book_id>/return")
@require_auth
def return_book(book_id):
    with get_db_connection() as connection:
        row = connection.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
        if not row:
            return error_response("Book not found.", 404)
        if row["status"] == "available":
            return error_response("Book is already available.", 400)

        # Update book status
        connection.execute("UPDATE books SET status = 'available' WHERE id = ?", (book_id,))
        # Update borrow record
        connection.execute(
            "UPDATE borrow_records SET status = 'returned', return_date = CURRENT_TIMESTAMP WHERE book_id = ? AND status = 'active'",
            (book_id,)
        )
        connection.commit()

    return jsonify({"success": True, "message": "Book returned successfully."})

@books_bp.delete("/<int:book_id>")
@require_auth
def delete_book(book_id):
    with get_db_connection() as connection:
        deleted = connection.execute("DELETE FROM books WHERE id = ?", (book_id,)).rowcount
        connection.commit()

    if deleted == 0:
        return error_response("Book not found.", 404)

    return jsonify({"success": True, "message": "Book deleted successfully."})
