import os
import sqlite3
from pathlib import Path
from werkzeug.security import generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "library.db"))

def get_db_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection

def init_db():
    with get_db_connection() as connection:
        # Users table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        """)
        
        # Books table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'issued'))
            )
        """)
        
        # Borrow Records table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS borrow_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                borrower_name TEXT NOT NULL,
                borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                return_date DATETIME,
                status TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'returned')),
                FOREIGN KEY (book_id) REFERENCES books (id)
            )
        """)
        
        # Seed default admin if not exists
        admin_user = os.getenv("ADMIN_USERNAME", "admin").strip()
        admin_pass = os.getenv("ADMIN_PASSWORD", "admin").strip()
        
        admin = connection.execute("SELECT * FROM users WHERE username = ?", (admin_user,)).fetchone()
        if not admin:
            hashed_pwd = generate_password_hash(admin_pass)
            connection.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (admin_user, hashed_pwd))
            
        connection.commit()
