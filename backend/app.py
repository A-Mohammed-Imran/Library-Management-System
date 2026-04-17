import os
import sqlite3
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "library.db"))

# Keep CORS open by default for easy setup, then lock it in production with CORS_ORIGINS.
raw_origins = os.getenv("CORS_ORIGINS", "*").strip()
allowed_origins = "*" if raw_origins == "*" else [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}})


def get_db_connection():
    """Create a new SQLite connection with dict-like row access."""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    """Create books table if missing."""
    with get_db_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'issued'))
            )
            """
        )
        connection.commit()


def book_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "author": row["author"],
        "status": row["status"],
    }


def error_response(message, status_code=400):
    return jsonify({"success": False, "message": message}), status_code


@app.get("/api/health")
def health_check():
    return jsonify({"success": True, "message": "API is running"})


@app.get("/api/stats")
def get_stats():
    with get_db_connection() as connection:
        stats = connection.execute(
            """
            SELECT
                COUNT(*) AS total_books,
                SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_books,
                SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) AS issued_books
            FROM books
            """
        ).fetchone()

    return jsonify(
        {
            "success": True,
            "data": {
                "total_books": stats["total_books"] or 0,
                "available_books": stats["available_books"] or 0,
                "issued_books": stats["issued_books"] or 0,
            },
        }
    )


@app.get("/api/books")
def get_books():
    query = request.args.get("query", "").strip()

    with get_db_connection() as connection:
        if query:
            like_query = f"%{query}%"
            rows = connection.execute(
                "SELECT * FROM books WHERE title LIKE ? COLLATE NOCASE ORDER BY id DESC",
                (like_query,),
            ).fetchall()
        else:
            rows = connection.execute("SELECT * FROM books ORDER BY id DESC").fetchall()

    return jsonify({"success": True, "data": [book_to_dict(row) for row in rows]})


@app.get("/api/books/<int:book_id>")
def get_book(book_id):
    with get_db_connection() as connection:
        row = connection.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()

    if not row:
        return error_response("Book not found.", 404)

    return jsonify({"success": True, "data": book_to_dict(row)})


@app.post("/api/books")
def add_book():
    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title", "")).strip()
    author = str(payload.get("author", "")).strip()

    if not title:
        return error_response("Title is required.", 400)
    if not author:
        return error_response("Author is required.", 400)
    if len(title) > 120 or len(author) > 120:
        return error_response("Title and author must be 120 characters or less.", 400)

    with get_db_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO books (title, author, status) VALUES (?, ?, 'available')",
            (title, author),
        )
        connection.commit()
        book_id = cursor.lastrowid

    with get_db_connection() as connection:
        row = connection.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()

    return (
        jsonify({"success": True, "message": "Book added successfully.", "data": book_to_dict(row)}),
        201,
    )


@app.patch("/api/books/<int:book_id>/issue")
def issue_book(book_id):
    with get_db_connection() as connection:
        row = connection.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()

        if not row:
            return error_response("Book not found.", 404)
        if row["status"] == "issued":
            return error_response("Book is already issued.", 400)

        connection.execute("UPDATE books SET status = 'issued' WHERE id = ?", (book_id,))
        connection.commit()

    return jsonify({"success": True, "message": "Book issued successfully."})


@app.patch("/api/books/<int:book_id>/return")
def return_book(book_id):
    with get_db_connection() as connection:
        row = connection.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()

        if not row:
            return error_response("Book not found.", 404)
        if row["status"] == "available":
            return error_response("Book is already available.", 400)

        connection.execute("UPDATE books SET status = 'available' WHERE id = ?", (book_id,))
        connection.commit()

    return jsonify({"success": True, "message": "Book returned successfully."})


@app.delete("/api/books/<int:book_id>")
def delete_book(book_id):
    with get_db_connection() as connection:
        deleted = connection.execute("DELETE FROM books WHERE id = ?", (book_id,)).rowcount
        connection.commit()

    if deleted == 0:
        return error_response("Book not found.", 404)

    return jsonify({"success": True, "message": "Book deleted successfully."})


@app.errorhandler(404)
def handle_404(_):
    return error_response("Route not found.", 404)


@app.errorhandler(405)
def handle_405(_):
    return error_response("Method not allowed.", 405)


@app.errorhandler(500)
def handle_500(_):
    return error_response("Internal server error.", 500)


init_db()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug_mode = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug_mode)