const state = {
    allBooks: [],
    searchBooks: [],
    history: [],
    isBackendAwake: false,
    authToken: localStorage.getItem("lib_token") || "",
};

const elements = {
    flashMessage: document.getElementById("flashMessage"),
    menuButton: document.getElementById("menuButton"),
    navMenu: document.getElementById("navMenu"),
    
    loginForm: document.getElementById("loginForm"),
    navLogoutBtn: document.getElementById("navLogoutBtn"),
    
    addBookForm: document.getElementById("addBookForm"),
    refreshBooksButton: document.getElementById("refreshBooks"),
    allBooksBody: document.getElementById("allBooksBody"),
    allBooksEmpty: document.getElementById("allBooksEmpty"),
    
    searchForm: document.getElementById("searchForm"),
    searchQueryInput: document.getElementById("searchQuery"),
    statusFilter: document.getElementById("statusFilter"),
    searchBooksBody: document.getElementById("searchBooksBody"),
    searchBooksEmpty: document.getElementById("searchBooksEmpty"),
    
    historyBody: document.getElementById("historyBody"),
    historyEmpty: document.getElementById("historyEmpty"),
    
    serverStatusBadge: document.getElementById("serverStatus"),
    serverStatusText: document.querySelector("#serverStatus .status-text"),
    
    issueModal: document.getElementById("issueModal"),
    issueForm: document.getElementById("issueForm"),
    issueModalBookTitle: document.getElementById("issueModalBookTitle"),
    closeIssueModalBtn: document.getElementById("closeIssueModal"),
    borrowerNameInput: document.getElementById("borrowerName")
};

let toastTimeout;
let currentIssueBookId = null;

function isLoggedIn() {
    return !!state.authToken;
}

function updateAuthUI() {
    const authOnly = document.querySelectorAll(".auth-only");
    const publicOnly = document.querySelectorAll(".public-only");
    
    if (isLoggedIn()) {
        authOnly.forEach(el => el.classList.remove("hidden"));
        publicOnly.forEach(el => el.classList.add("hidden"));
    } else {
        authOnly.forEach(el => el.classList.add("hidden"));
        publicOnly.forEach(el => el.classList.remove("hidden"));
    }
}

function showMessage(message, type = "success") {
    if (type === "warning") type = "error"; 
    elements.flashMessage.textContent = message;
    elements.flashMessage.className = `flash-message ${type}`;
    elements.flashMessage.classList.remove("hidden");
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        hideMessage();
    }, 4000);
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
    
    if (error.status === 401) {
        // Token might be expired or invalid
        handleLogout(false);
        showMessage("Session expired. Please log in again.", "error");
    }
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

    if (isLoggedIn()) {
        requestOptions.headers["Authorization"] = `Bearer ${state.authToken}`;
    }

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
        const error = new Error(data.message || `Request failed with status ${response.status}.`);
        error.status = response.status;
        throw error;
    }

    return data;
}

function createActions(book) {
    if (!isLoggedIn()) return `<span class="muted-text" style="font-size:12px;">Login to manage</span>`;
    
    const statusAction =
        book.status === "available"
            ? `<button class="btn btn-warning" data-action="issue" data-id="${book.id}" data-title="${book.title.replace(/"/g, '&quot;')}" type="button">Issue</button>`
            : `<button class="btn btn-success" data-action="return" data-id="${book.id}" type="button">Return</button>`;

    const deleteAction = `<button class="btn btn-danger" data-action="delete" data-id="${book.id}" type="button">Delete</button>`;

    return `
        <div class="actions-group">
            ${statusAction}
            ${deleteAction}
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

function renderHistoryTable() {
    elements.historyBody.innerHTML = "";
    if (!state.history.length) {
        elements.historyEmpty.classList.remove("hidden");
        return;
    }
    elements.historyEmpty.classList.add("hidden");
    
    state.history.forEach(record => {
        const row = document.createElement("tr");
        const bDate = new Date(record.borrow_date + "Z").toLocaleString();
        const rDate = record.return_date ? new Date(record.return_date + "Z").toLocaleString() : "-";
        
        row.innerHTML = `
            <td><strong>${record.book_title}</strong><br><small class="muted-text">${record.book_author}</small></td>
            <td>${record.borrower_name}</td>
            <td>${bDate}</td>
            <td>${rDate}</td>
            <td><span class="status-pill ${record.status === 'active' ? 'issued' : 'available'}">${record.status}</span></td>
        `;
        elements.historyBody.appendChild(row);
    });
}

async function loadAllBooks() {
    const response = await apiRequest("/books");
    state.allBooks = response.data;
    renderBooksTable(elements.allBooksBody, elements.allBooksEmpty, state.allBooks, "No books found.");
}

async function loadSearchBooks(query, status) {
    let url = `/books?query=${encodeURIComponent(query)}`;
    if (status) url += `&status=${status}`;
    
    const response = await apiRequest(url);
    state.searchBooks = response.data;
    renderBooksTable(elements.searchBooksBody, elements.searchBooksEmpty, state.searchBooks, "No books found matching criteria.");
}

async function loadHistory() {
    if (!isLoggedIn()) return;
    try {
        const response = await apiRequest("/history");
        state.history = response.data;
        renderHistoryTable();
    } catch (e) {
        console.error("Failed to load history", e);
    }
}

async function loadDashboardStats() {
    try {
        const response = await apiRequest("/stats");
        if (response.success && response.data) {
            document.getElementById("statTotal").textContent = response.data.total_books;
            document.getElementById("statAvailable").textContent = response.data.available_books;
            document.getElementById("statIssued").textContent = response.data.issued_books;
        }
    } catch (e) {
        console.error("Failed to load stats", e);
    }
}

async function refreshDashboard() {
    const promises = [loadAllBooks(), loadDashboardStats()];
    if (isLoggedIn()) {
        promises.push(loadHistory());
    }
    await Promise.all(promises);
}

function checkBackendReady() {
    if (!state.isBackendAwake) {
        showMessage("Server still waking up... Please wait a moment.", "warning");
        return false;
    }
    return true;
}

function openIssueModal(bookId, bookTitle) {
    currentIssueBookId = bookId;
    elements.issueModalBookTitle.textContent = bookTitle;
    elements.borrowerNameInput.value = "";
    elements.issueModal.classList.remove("hidden");
}

function closeIssueModal() {
    currentIssueBookId = null;
    elements.issueModal.classList.add("hidden");
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
        if (action === "issue") {
            const title = button.dataset.title;
            openIssueModal(bookId, title);
            return;
        }
        
        if (action === "return") {
            await apiRequest(`/books/${bookId}/return`, { method: "PATCH" });
            showMessage("Book returned successfully.", "success");
        }
        
        if (action === "delete") {
            if (!confirm("Are you sure you want to delete this book?")) return;
            await apiRequest(`/books/${bookId}`, { method: "DELETE" });
            showMessage("Book deleted successfully.", "success");
        }

        await refreshDashboard();
        
        // Re-run search if there's an active query
        const currentQuery = elements.searchQueryInput.value.trim();
        const currentStatus = elements.statusFilter.value;
        if (currentQuery || currentStatus) {
            await loadSearchBooks(currentQuery, currentStatus);
        }
        
    } catch (error) {
        handleApiError(error, "Book action failed");
    }
}

function setupAuthForms() {
    if (elements.loginForm) {
        elements.loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!checkBackendReady()) return;
            hideMessage();
            
            const username = elements.loginForm.username.value.trim();
            const password = elements.loginForm.password.value;
            
            try {
                const res = await apiRequest("/auth/login", {
                    method: "POST",
                    body: { username, password }
                });
                state.authToken = res.data.token;
                localStorage.setItem("lib_token", state.authToken);
                elements.loginForm.reset();
                updateAuthUI();
                await refreshDashboard();
                window.location.hash = "#dashboard";
                showMessage("Logged in successfully.", "success");
            } catch (err) {
                handleApiError(err, "Login failed");
            }
        });
    }

    if (elements.navLogoutBtn) {
        elements.navLogoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            handleLogout(true);
        });
    }
}

async function handleLogout(notifyServer = false) {
    if (notifyServer && isLoggedIn() && state.isBackendAwake) {
        try {
            await apiRequest("/auth/logout", { method: "POST" });
        } catch (e) {
            console.error("Logout error", e);
        }
    }
    
    state.authToken = "";
    localStorage.removeItem("lib_token");
    updateAuthUI();
    // Re-render tables to remove action buttons
    renderBooksTable(elements.allBooksBody, elements.allBooksEmpty, state.allBooks, "No books found.");
    if (state.searchBooks.length > 0) {
        renderBooksTable(elements.searchBooksBody, elements.searchBooksEmpty, state.searchBooks, "No books found.");
    }
    showMessage("Logged out successfully.");
    window.location.hash = "#home";
}

function setupMenu() {
    elements.menuButton.addEventListener("click", () => {
        elements.navMenu.classList.toggle("open");
    });

    const links = elements.navMenu.querySelectorAll("a");
    
    // Update active class on hash change
    const updateActiveLink = () => {
        const hash = window.location.hash || "#home";
        links.forEach(link => {
            if (link.getAttribute("href") === hash) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
    };

    window.addEventListener("hashchange", updateActiveLink);
    updateActiveLink(); // initial call

    links.forEach((link) => {
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
        const status = elements.statusFilter.value;

        try {
            await loadSearchBooks(query, status);
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
            showMessage("Dashboard refreshed.", "success");
        } catch (error) {
            handleApiError(error, "Refresh failed");
        }
    });
}

function setupActionHandlers() {
    elements.allBooksBody.addEventListener("click", handleActionClick);
    elements.searchBooksBody.addEventListener("click", handleActionClick);
    
    elements.closeIssueModalBtn.addEventListener("click", closeIssueModal);
    
    elements.issueForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentIssueBookId || !checkBackendReady()) return;
        
        const borrowerName = elements.borrowerNameInput.value.trim();
        if (!borrowerName) return;
        
        try {
            await apiRequest(`/books/${currentIssueBookId}/issue`, {
                method: "PATCH",
                body: { borrower_name: borrowerName }
            });
            showMessage("Book issued successfully.", "success");
            closeIssueModal();
            await refreshDashboard();
            
            const currentQuery = elements.searchQueryInput.value.trim();
            const currentStatus = elements.statusFilter.value;
            if (currentQuery || currentStatus) {
                await loadSearchBooks(currentQuery, currentStatus);
            }
        } catch (err) {
            handleApiError(err, "Issue book failed");
        }
    });
}

function startBackendWakeup() {
    const healthUrl = `${API_URL.replace(/\/+$/, '')}/health`;
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
            elements.historyBody.innerHTML = "";
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
    updateAuthUI();
    setupMenu();
    setupAuthForms();
    setupAddBookForm();
    setupSearchForm();
    setupRefreshButton();
    setupActionHandlers();

    hideMessage();
    
    // Start the non-blocking background wake-up
    startBackendWakeup();
}

document.addEventListener('DOMContentLoaded', initializeApp);