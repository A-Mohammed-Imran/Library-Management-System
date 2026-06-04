// Frontend bootstrapper: waits for backend to become healthy before initializing app
// Requirements implemented:
// - Poll /api/health until healthy or timeout
// - Show fullscreen loader and messages
// - Retry and graceful failure handling

(function () {
    const MAX_TIMEOUT_MS = 60000; // 60 seconds overall
    const POLL_INTERVAL_MS = 2500; // base interval between attempts

    const overlayId = "backendLoaderOverlay";

    function $(id) {
        return document.getElementById(id);
    }

    function createOverlay() {
        if ($(overlayId)) return;

        const overlay = document.createElement("div");
        overlay.id = overlayId;
        overlay.className = "backend-loader-overlay";
        overlay.innerHTML = `
            <div class="backend-loader-card">
                <div class="loader-brand">Library Management</div>
                <div class="loader-spinner" aria-hidden="true"></div>
                <div id="loaderMessage" class="loader-message">Waking up server...</div>
                <div id="loaderSubMessage" class="loader-submessage">This may take up to 30 seconds</div>
                <div id="loaderDetails" class="loader-details"></div>
                <div class="loader-actions">
                    <button id="loaderRetry" class="btn btn-outline hidden" type="button">Retry</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
    }

    function showOverlay() {
        createOverlay();
        const o = $(overlayId);
        o.classList.remove("hidden");
        // prevent scrolling underneath
        document.documentElement.style.overflow = "hidden";
    }

    function hideOverlay() {
        const o = $(overlayId);
        if (!o) return;
        o.classList.add("fade-out");
        // restore scrolling after transition
        setTimeout(() => {
            if (o && o.parentNode) o.parentNode.removeChild(o);
            document.documentElement.style.overflow = "";
        }, 500);
    }

    function setMessage(text, subtext) {
        const m = $("loaderMessage");
        const s = $("loaderSubMessage");
        if (m) m.textContent = text;
        if (s && typeof subtext === "string") s.textContent = subtext;
    }

    function setDetails(text) {
        const d = $("loaderDetails");
        if (d) d.textContent = text;
    }

    function showRetry() {
        const btn = $("loaderRetry");
        if (btn) btn.classList.remove("hidden");
    }

    function hideRetry() {
        const btn = $("loaderRetry");
        if (btn) btn.classList.add("hidden");
    }

    async function fetchWithTimeout(url, timeout = 8000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const start = performance.now();
        try {
            const resp = await fetch(url, { signal: controller.signal, cache: "no-store" });
            const duration = Math.round(performance.now() - start);
            clearTimeout(id);
            return { resp, duration };
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    }

    function waitForBackend({ apiBase = (typeof API_URL !== 'undefined' ? API_URL : '/api'), timeout = MAX_TIMEOUT_MS, interval = POLL_INTERVAL_MS } = {}) {
        return new Promise((resolve, reject) => {
            showOverlay();
            setMessage('Waking up server...', 'This may take up to 30 seconds');
            hideRetry();

            const start = Date.now();
            let stopped = false;

            async function attempt() {
                if (stopped) return;
                const elapsed = Date.now() - start;
                setDetails(`Elapsed: ${Math.round(elapsed/1000)}s`);

                if (elapsed >= timeout) {
                    stopped = true;
                    setMessage('Server unavailable', 'Could not reach backend within timeout');
                    setDetails('Please check your network or try again.');
                    showRetry();
                    return reject(new Error('Health check timeout'));
                }

                try {
                    const url = apiBase.replace(/\/+$/, '') + '/health';
                    const { resp, duration } = await fetchWithTimeout(url, 8000);
                    let json = null;
                    try { json = await resp.json(); } catch (_) { json = null; }

                    if (resp.ok && json && json.success && (json.status === 'healthy' || json.status === 'ok' || json.message)) {
                        stopped = true;
                        setDetails(`Responded in ${duration}ms`);
                        // slight delay for UX smoothness
                        setMessage('Server is awake', 'Initializing application...');
                        hideRetry();
                        setTimeout(() => resolve(), 350);
                        return;
                    }
                } catch (err) {
                    // network or abort
                    // console.debug('Health check attempt failed', err);
                }

                // exponential-ish backoff, cap at 5s
                const next = Math.min(interval * 1.25, 5000);
                setTimeout(attempt, interval);
            }

            attempt();

            // expose retry button handler
            document.addEventListener('click', function handler(e) {
                const target = e.target;
                if (target && target.id === 'loaderRetry') {
                    // hide retry and restart
                    hideRetry();
                    setMessage('Retrying...', 'Attempting to reach backend');
                    // small delay to allow UI update
                    setTimeout(() => {
                        // reset start time
                        stopAndRestart();
                    }, 200);
                }
            });

            function stopAndRestart() {
                // simply call attempt again; the internal timeout/time check uses original start
                // For simplicity, reload the page to restart full flow
                // But we attempt a fresh loop by throwing away overlay and starting again
                // Here we just reload the page to ensure a clean state
                window.location.reload();
            }
        });
    }

    // Boot sequence: run on DOM ready
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await waitForBackend();
            // call app initializer if available
            if (window.initializeApp && typeof window.initializeApp === 'function') {
                try {
                    await window.initializeApp();
                } catch (err) {
                    console.error('Application initialization failed:', err);
                }
            }
        } catch (err) {
            // already handled in waitForBackend (shows retry)
            console.warn('Backend did not respond in time:', err);
        } finally {
            hideOverlay();
        }
    });

})();
