const defaultApiUrl = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || "http://127.0.0.1:5000/api";

const state = {
    apiBaseUrl: localStorage.getItem("libraryApiBaseUrl") || defaultApiUrl,
    allBooks: [],
    searchBooks: [],
};


const elements = {
    flashMessage: document.getElementById("flashMessage"),
    menuButton: document.getElementById("menuButton"),
    navMenu: document.getElementById("navMenu"),
    apiUrlInput: document.getElementById("apiUrl"),
    saveApiUrlButton: document.getElementById("saveApiUrl"),
    addBookForm: document.getElementById("addBookForm"),
    refreshBooksButton: document.getElementById("refreshBooks"),
    allBooksBody: document.getElementById("allBooksBody"),
    allBooksEmpty: document.getElementById("allBooksEmpty"),
    searchForm: document.getElementById("searchForm"),
    searchQueryInput: document.getElementById("searchQuery"),
    searchBooksBody: document.getElementById("searchBooksBody"),
    searchBooksEmpty: document.getElementById("searchBooksEmpty"),
    totalBooks: document.getElementById("totalBooks"),
    availableBooks: document.getElementById("availableBooks"),
    issuedBooks: document.getElementById("issuedBooks"),
};


function normalizeApiUrl(url) {
    return (url || "").trim().replace(/\/+$/, "");
}


function showMessage(message, type = "success") {
    elements.flashMessage.textContent = message;
    elements.flashMessage.className = `flash-message ${type}`;
    elements.flashMessage.classList.remove("hidden");
}


function hideMessage() {
    elements.flashMessage.textContent = "";
    elements.flashMessage.className = "flash-message hidden";
}


function setApiUrl(url, notify = true) {
    const normalized = normalizeApiUrl(url);
    if (!normalized) {
        showMessage("Please provide a valid API URL.", "error");
        return;
    }

    state.apiBaseUrl = normalized;
    localStorage.setItem("libraryApiBaseUrl", normalized);
    elements.apiUrlInput.value = normalized;

    if (notify) {
        showMessage("API URL saved.", "success");
    }
}


async function apiRequest(path, options = {}) {
    const url = `${state.apiBaseUrl}${path}`;
    const requestOptions = {
        method: options.method || "GET",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    };

    if (options.body !== undefined) {
        requestOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, requestOptions);
    let data;

    try {
        data = await response.json();
    } catch (_error) {
        data = { success: false, message: "Invalid response from server." };
    }

    if (!response.ok || !data.success) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}


function createActions(book) {
    const statusAction =
        book.status === "available"
            ? `<button class="btn btn-warning" data-action="issue" data-id="${book.id}" type="button">Issue</button>`
            : `<button class="btn btn-success" data-action="return" data-id="${book.id}" type="button">Return</button>`;

    return `
        <div class="actions-group">
            ${statusAction}
            <button class="btn btn-danger" data-action="delete" data-id="${book.id}" type="button">Delete</button>
        </div>
    `;
}


function renderBooksTable(targetBody, emptyNode, books, emptyMessage) {
    targetBody.innerHTML = "";

    if (!books.length) {
        emptyNode.textContent = emptyMessage;
        emptyNode.classList.remove("hidden");
        return;
    }

    emptyNode.classList.add("hidden");

    books.forEach((book) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${book.id}</td>
            <td>${book.title}</td>
            <td>${book.author}</td>
            <td><span class="status-pill ${book.status}">${book.status}</span></td>
            <td>${createActions(book)}</td>
        `;
        targetBody.appendChild(row);
    });
}


async function loadStats() {
    const response = await apiRequest("/stats");
    const stats = response.data;

    elements.totalBooks.textContent = String(stats.total_books);
    elements.availableBooks.textContent = String(stats.available_books);
    elements.issuedBooks.textContent = String(stats.issued_books);
}


async function loadAllBooks() {
    const response = await apiRequest("/books");
    state.allBooks = response.data;

    renderBooksTable(
        elements.allBooksBody,
        elements.allBooksEmpty,
        state.allBooks,
        "No books found. Add your first book."
    );
}


async function loadSearchBooks(query) {
    const response = await apiRequest(`/books?query=${encodeURIComponent(query)}`);
    state.searchBooks = response.data;

    const emptyMessage = `No books found for "${query}".`;
    renderBooksTable(elements.searchBooksBody, elements.searchBooksEmpty, state.searchBooks, emptyMessage);
}


async function refreshDashboard() {
    await Promise.all([loadStats(), loadAllBooks()]);
}


async function runBookAction(action, bookId) {
    if (action === "issue") {
        await apiRequest(`/books/${bookId}/issue`, { method: "PATCH" });
        showMessage("Book issued successfully.", "success");
        return;
    }

    if (action === "return") {
        await apiRequest(`/books/${bookId}/return`, { method: "PATCH" });
        showMessage("Book returned successfully.", "success");
        return;
    }

    if (action === "delete") {
        const confirmed = window.confirm("Delete this book permanently?");
        if (!confirmed) {
            return;
        }
        await apiRequest(`/books/${bookId}`, { method: "DELETE" });
        showMessage("Book deleted successfully.", "success");
    }
}


async function handleActionClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    const action = button.dataset.action;
    const bookId = Number(button.dataset.id);
    if (!action || Number.isNaN(bookId)) {
        return;
    }

    hideMessage();

    try {
        await runBookAction(action, bookId);
        await refreshDashboard();

        const currentQuery = elements.searchQueryInput.value.trim();
        if (currentQuery) {
            await loadSearchBooks(currentQuery);
        }
    } catch (error) {
        showMessage(error.message, "error");
    }
}


function setupMenu() {
    elements.menuButton.addEventListener("click", () => {
        elements.navMenu.classList.toggle("open");
    });

    elements.navMenu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            elements.navMenu.classList.remove("open");
        });
    });
}


function setupApiUrlControls() {
    elements.apiUrlInput.value = state.apiBaseUrl;

    elements.saveApiUrlButton.addEventListener("click", async () => {
        hideMessage();
        setApiUrl(elements.apiUrlInput.value);

        try {
            await apiRequest("/health");
            showMessage("Connected to backend API successfully.", "success");
            await refreshDashboard();
        } catch (error) {
            showMessage(`Saved URL, but connection failed: ${error.message}`, "error");
        }
    });
}


function setupAddBookForm() {
    elements.addBookForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideMessage();

        const title = elements.addBookForm.title.value.trim();
        const author = elements.addBookForm.author.value.trim();

        if (!title || !author) {
            showMessage("Title and author are required.", "error");
            return;
        }

        try {
            await apiRequest("/books", {
                method: "POST",
                body: { title, author },
            });

            elements.addBookForm.reset();
            showMessage("Book added successfully.", "success");
            await refreshDashboard();
        } catch (error) {
            showMessage(error.message, "error");
        }
    });
}


function setupSearchForm() {
    elements.searchForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideMessage();

        const query = elements.searchQueryInput.value.trim();
        if (!query) {
            showMessage("Please enter a title to search.", "error");
            return;
        }

        try {
            await loadSearchBooks(query);
            showMessage(`Search completed for "${query}".`, "success");
        } catch (error) {
            showMessage(error.message, "error");
        }
    });
}


function setupRefreshButton() {
    elements.refreshBooksButton.addEventListener("click", async () => {
        hideMessage();
        try {
            await refreshDashboard();
            showMessage("Book list refreshed.", "success");
        } catch (error) {
            showMessage(error.message, "error");
        }
    });
}


function setupActionHandlers() {
    elements.allBooksBody.addEventListener("click", handleActionClick);
    elements.searchBooksBody.addEventListener("click", handleActionClick);
}


async function initializeApp() {
    setupMenu();
    setupApiUrlControls();
    setupAddBookForm();
    setupSearchForm();
    setupRefreshButton();
    setupActionHandlers();

    hideMessage();

    try {
        await apiRequest("/health");
        await refreshDashboard();
        showMessage("Connected to backend API.", "success");
    } catch (error) {
        showMessage(
            `Could not connect to backend: ${error.message}. Update the API URL and try again.`,
            "error"
        );
    }
}


initializeApp();