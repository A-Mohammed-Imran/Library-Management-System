const state = {
    allBooks: [],
    searchBooks: [],
};


const elements = {
    flashMessage: document.getElementById("flashMessage"),
    menuButton: document.getElementById("menuButton"),
    navMenu: document.getElementById("navMenu"),
    addBookForm: document.getElementById("addBookForm"),
    refreshBooksButton: document.getElementById("refreshBooks"),
    allBooksBody: document.getElementById("allBooksBody"),
    allBooksEmpty: document.getElementById("allBooksEmpty"),
    searchForm: document.getElementById("searchForm"),
    searchQueryInput: document.getElementById("searchQuery"),
    searchBooksBody: document.getElementById("searchBooksBody"),
    searchBooksEmpty: document.getElementById("searchBooksEmpty"),
};


function showMessage(message, type = "success") {
    elements.flashMessage.textContent = message;
    elements.flashMessage.className = `flash-message ${type}`;
    elements.flashMessage.classList.remove("hidden");
}


function hideMessage() {
    elements.flashMessage.textContent = "";
    elements.flashMessage.className = "flash-message hidden";
}


function handleApiError(error, context = "API request failed") {
    const message = error && error.message ? error.message : "Something went wrong. Please try again.";
    console.error(`${context}:`, error);
    showMessage(message, "error");
    window.alert(message);
}


async function apiRequest(path, options = {}) {
    const requestUrl = `${API_URL}${path}`;
    const requestOptions = {
        method: options.method || "GET",
        mode: "cors",
        headers: {
            "Accept": "application/json",
            ...(options.headers || {}),
        },
    };

    if (options.body !== undefined) {
        requestOptions.headers["Content-Type"] = "application/json";
        requestOptions.body = JSON.stringify(options.body);
    }

    let response;

    try {
        response = await fetch(`${API_URL}${path}`, requestOptions);
    } catch (networkError) {
        console.error("Network error during API call:", networkError);
        throw new Error("Cannot connect to backend server. Please check your internet or backend URL.");
    }

    let data;

    try {
        data = await response.json();
    } catch (_error) {
        data = { success: false, message: "Invalid response from server." };
    }

    if (!response.ok || !data.success) {
        const message = data.message || `Request failed with status ${response.status}.`;
        console.error("API responded with an error:", {
            url: requestUrl,
            status: response.status,
            response: data,
        });
        throw new Error(message);
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
    await loadAllBooks();
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
        handleApiError(error, "Book action failed");
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
            handleApiError(error, "Add book failed");
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
            handleApiError(error, "Search failed");
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
            handleApiError(error, "Refresh failed");
        }
    });
}


function setupActionHandlers() {
    elements.allBooksBody.addEventListener("click", handleActionClick);
    elements.searchBooksBody.addEventListener("click", handleActionClick);
}


async function initializeApp() {
    setupMenu();
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
        handleApiError(error, "Initial API connection failed");
    }
}


initializeApp();