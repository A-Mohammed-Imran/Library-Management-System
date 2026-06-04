const state = {
    allBooks: [],
    searchBooks: [],
    isBackendAwake: false,
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
    serverStatusBadge: document.getElementById("serverStatus"),
    serverStatusText: document.querySelector("#serverStatus .status-text"),
};

function showMessage(message, type = "success") {
    // We treat warning similarly to error visually if no specific warning style is present,
    // or just let it use its own class if it exists in css.
    if (type === "warning") type = "error"; 
    elements.flashMessage.textContent = message;
    elements.flashMessage.className = `flash-message ${type}`;
    elements.flashMessage.classList.remove("hidden");
}

function hideMessage() {
    elements.flashMessage.textContent = "";
    elements.flashMessage.className = "flash-message hidden";
}

function updateServerStatus(status) {
    const badge = elements.serverStatusBadge;
    const text = elements.serverStatusText;
    badge.className = `status-badge ${status}`;
    
    if (status === "connecting") {
        text.textContent = "Connecting...";
        badge.title = "Waking up server in the background";
    } else if (status === "online") {
        text.textContent = "Server Online";
        badge.title = "Connected to backend API";
    } else if (status === "offline") {
        text.textContent = "Server Offline";
        badge.title = "Could not reach backend";
    }
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
        response = await fetch(requestUrl, requestOptions);
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

function checkBackendReady() {
    if (!state.isBackendAwake) {
        showMessage("Server still waking up... Please wait a moment.", "warning");
        return false;
    }
    return true;
}

async function handleActionClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    if (!checkBackendReady()) return;

    const action = button.dataset.action;
    const bookId = Number(button.dataset.id);
    if (!action || Number.isNaN(bookId)) return;

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
        if (!checkBackendReady()) return;
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
        if (!checkBackendReady()) return;
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
        if (!checkBackendReady()) return;
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

function startBackendWakeup() {
    // Usually API_URL ends without a slash, but let's be safe
    const healthUrl = \`\${API_URL.replace(/\\/+$/, '')}/health\`;
    const MAX_TIMEOUT_MS = 60000;
    const MAX_INTERVAL = 5000;
    const startTime = Date.now();
    let intervalMs = 2000;
    
    updateServerStatus("connecting");

    const attempt = async () => {
        if (state.isBackendAwake) return;

        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_TIMEOUT_MS) {
            console.error("Backend wake-up timeout");
            updateServerStatus("offline");
            showMessage("Server is unreachable. Please try reloading.", "error");
            // Clear skeletons
            elements.allBooksBody.innerHTML = "";
            elements.searchBooksBody.innerHTML = "";
            elements.allBooksEmpty.classList.remove("hidden");
            elements.allBooksEmpty.textContent = "Server is offline.";
            return;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const res = await fetch(healthUrl, { signal: controller.signal, cache: 'no-store' });
            clearTimeout(timeoutId);
            
            if (res.ok) {
                const data = await res.json().catch(() => null);
                if (data && data.success) {
                    console.log("Backend is awake!");
                    state.isBackendAwake = true;
                    updateServerStatus("online");
                    
                    // Now that backend is awake, load initial data
                    try {
                        await refreshDashboard();
                    } catch (err) {
                        handleApiError(err, "Initial data load failed");
                    }
                    return;
                }
            }
        } catch (err) {
            // Ignore fetch errors during polling
        }

        // Retry with backoff
        intervalMs = Math.min(intervalMs * 1.25, MAX_INTERVAL);
        setTimeout(attempt, intervalMs);
    };

    attempt();
}

function initializeApp() {
    setupMenu();
    setupAddBookForm();
    setupSearchForm();
    setupRefreshButton();
    setupActionHandlers();

    hideMessage();
    
    // Start the non-blocking background wake-up
    startBackendWakeup();
}

// Auto-run since we no longer use a separate bootstrapper script
document.addEventListener('DOMContentLoaded', initializeApp);