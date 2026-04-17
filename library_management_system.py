import json
import os


DATA_FILE = "books_data.json"


def load_books():
    """Load books from a JSON file. Return an empty list if file is missing or invalid."""
    if not os.path.exists(DATA_FILE):
        return []

    try:
        with open(DATA_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)

        if isinstance(data, list):
            return data

        print("Warning: Data file format is invalid. Starting with an empty library.")
        return []
    except (json.JSONDecodeError, OSError):
        print("Warning: Could not read data file. Starting with an empty library.")
        return []


def save_books(books):
    """Save books list to a JSON file."""
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as file:
            json.dump(books, file, indent=4)
    except OSError:
        print("Error: Could not save books to file.")


def find_book_by_id(books, book_id):
    """Return the book dictionary that matches the given ID, or None."""
    for book in books:
        if book["id"] == book_id:
            return book
    return None


def add_book(books):
    """Add a new book to the library."""
    print("\nAdd New Book")
    title = input("Enter book title: ").strip()
    author = input("Enter author name: ").strip()
    book_id = input("Enter book ID: ").strip()

    if not title or not author or not book_id:
        print("Error: Title, author, and ID cannot be empty.")
        return

    if find_book_by_id(books, book_id):
        print("Error: A book with this ID already exists.")
        return

    new_book = {
        "title": title,
        "author": author,
        "id": book_id,
        "issued": False,
    }
    books.append(new_book)
    save_books(books)
    print("Book added successfully.")


def view_books(books):
    """Display all books in the library."""
    print("\nAll Books")
    if not books:
        print("No books in the library yet.")
        return

    for index, book in enumerate(books, start=1):
        status = "Issued" if book["issued"] else "Available"
        print(
            f"{index}. Title: {book['title']} | Author: {book['author']} "
            f"| ID: {book['id']} | Status: {status}"
        )


def search_book_by_title(books):
    """Search and display books that match a title keyword."""
    print("\nSearch Book By Title")
    keyword = input("Enter full or partial title: ").strip()

    if not keyword:
        print("Error: Search text cannot be empty.")
        return

    matches = []
    for book in books:
        if keyword.lower() in book["title"].lower():
            matches.append(book)

    if not matches:
        print("Book not found.")
        return

    print("Matching books:")
    for index, book in enumerate(matches, start=1):
        status = "Issued" if book["issued"] else "Available"
        print(
            f"{index}. Title: {book['title']} | Author: {book['author']} "
            f"| ID: {book['id']} | Status: {status}"
        )


def issue_book(books):
    """Issue a book if it exists and is currently available."""
    print("\nIssue Book")
    book_id = input("Enter book ID to issue: ").strip()

    if not book_id:
        print("Error: Book ID cannot be empty.")
        return

    book = find_book_by_id(books, book_id)
    if not book:
        print("Book not found.")
        return

    if book["issued"]:
        print("This book is already issued.")
        return

    book["issued"] = True
    save_books(books)
    print("Book issued successfully.")


def return_book(books):
    """Return a book if it exists and is currently issued."""
    print("\nReturn Book")
    book_id = input("Enter book ID to return: ").strip()

    if not book_id:
        print("Error: Book ID cannot be empty.")
        return

    book = find_book_by_id(books, book_id)
    if not book:
        print("Book not found.")
        return

    if not book["issued"]:
        print("This book is not currently issued.")
        return

    book["issued"] = False
    save_books(books)
    print("Book returned successfully.")


def show_menu():
    """Display menu options."""
    print("\n===== Library Management System =====")
    print("1. Add a new book")
    print("2. View all books")
    print("3. Search for a book by title")
    print("4. Issue a book")
    print("5. Return a book")
    print("6. Exit")


def main():
    """Run the menu-driven library system."""
    books = load_books()
    print("Welcome to the Library Management System")

    while True:
        show_menu()
        choice = input("Enter your choice (1-6): ").strip()

        if choice == "1":
            add_book(books)
        elif choice == "2":
            view_books(books)
        elif choice == "3":
            search_book_by_title(books)
        elif choice == "4":
            issue_book(books)
        elif choice == "5":
            return_book(books)
        elif choice == "6":
            save_books(books)
            print("Thank you for using the system. Goodbye!")
            break
        else:
            print("Invalid choice. Please select a number from 1 to 6.")


if __name__ == "__main__":
    main()