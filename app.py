import sqlite3
from pathlib import Path

from flask import Flask, flash, redirect, render_template, request, url_for


app = Flask(__name__)
app.config["SECRET_KEY"] = "library-secret-key"

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "library.db"


def get_db_connection():
    """Create a new SQLite connection."""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    """Create the books table if it does not exist."""
    with get_db_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'available'
            )
            """
        )
        connection.commit()


def get_next_url(default_endpoint="view_books"):
    """Return a safe next URL for redirects after actions like issue/return."""
    next_url = request.form.get("next_url", "").strip()
    if next_url.startswith("/"):
        return next_url
    return url_for(default_endpoint)


@app.route("/")
def home():
    """Home page with quick library statistics."""
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

    total_books = stats["total_books"] or 0
    available_books = stats["available_books"] or 0
    issued_books = stats["issued_books"] or 0

    return render_template(
        "home.html",
        total_books=total_books,
        available_books=available_books,
        issued_books=issued_books,
    )


@app.route("/books")
def view_books():
    """Show all books in a table."""
    with get_db_connection() as connection:
        books = connection.execute("SELECT * FROM books ORDER BY id DESC").fetchall()

    return render_template("books.html", books=books)


@app.route("/books/search")
def search_books():
    """Search books by title (full or partial text)."""
    query = request.args.get("query", "").strip()
    submitted = "query" in request.args
    books = []

    if submitted and not query:
        flash("Please enter a title to search.", "error")
    elif query:
        like_query = f"%{query}%"
        with get_db_connection() as connection:
            books = connection.execute(
                "SELECT * FROM books WHERE title LIKE ? COLLATE NOCASE ORDER BY id DESC",
                (like_query,),
            ).fetchall()

    return render_template("search.html", books=books, query=query, submitted=submitted)


@app.route("/books/add", methods=["GET", "POST"])
def add_book():
    """Add a new book to the database."""
    form_data = {"title": "", "author": ""}

    if request.method == "POST":
        title = request.form.get("title", "").strip()
        author = request.form.get("author", "").strip()
        form_data = {"title": title, "author": author}

        if not title or not author:
            flash("Title and author are required.", "error")
            return render_template("add_book.html", form_data=form_data)

        with get_db_connection() as connection:
            connection.execute(
                "INSERT INTO books (title, author, status) VALUES (?, ?, 'available')",
                (title, author),
            )
            connection.commit()

        flash("Book added successfully.", "success")
        return redirect(url_for("view_books"))

    return render_template("add_book.html", form_data=form_data)


@app.route("/books/<int:book_id>/issue", methods=["POST"])
def issue_book(book_id):
    """Mark a book as issued if it is currently available."""
    with get_db_connection() as connection:
        book = connection.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()

        if not book:
            flash("Book not found.", "error")
            return redirect(get_next_url())

        if book["status"] == "issued":
            flash("This book is already issued.", "error")
            return redirect(get_next_url())

        connection.execute("UPDATE books SET status = 'issued' WHERE id = ?", (book_id,))
        connection.commit()

    flash("Book issued successfully.", "success")
    return redirect(get_next_url())


@app.route("/books/<int:book_id>/return", methods=["POST"])
def return_book(book_id):
    """Mark a book as available if it is currently issued."""
    with get_db_connection() as connection:
        book = connection.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()

        if not book:
            flash("Book not found.", "error")
            return redirect(get_next_url())

        if book["status"] == "available":
            flash("This book is already available.", "error")
            return redirect(get_next_url())

        connection.execute("UPDATE books SET status = 'available' WHERE id = ?", (book_id,))
        connection.commit()

    flash("Book returned successfully.", "success")
    return redirect(get_next_url())


@app.route("/books/<int:book_id>/delete", methods=["POST"])
def delete_book(book_id):
    """Delete a book record. This completes CRUD support."""
    with get_db_connection() as connection:
        deleted = connection.execute("DELETE FROM books WHERE id = ?", (book_id,)).rowcount
        connection.commit()

    if deleted:
        flash("Book deleted successfully.", "success")
    else:
        flash("Book not found.", "error")

    return redirect(get_next_url())


if __name__ == "__main__":
    init_db()
    app.run(debug=True)