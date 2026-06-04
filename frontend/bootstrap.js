// Frontend bootstrapper: waits for backend to become healthy before initializing app
// Optimized flow:
//   1. Show overlay immediately
//   2. Ping backend ONCE right away (no initial delay)
//   3. On FIRST success -> stop immediately, hide loader, init app
//   4. Only if failed -> retry every 2 s (capped at 5 s with backoff)

(function () {
    // ─── Configuration ────────────────────────────────────────────────────────
    const MAX_TIMEOUT_MS  = 60000; // give up after 60 s total
    const BASE_INTERVAL   = 2000;  // retry interval (ms) after first failure
    const MAX_INTERVAL    = 5000;  // cap on backoff interval
    const MIN_DISPLAY_MS  = 300;   // minimum time loader is visible (avoids flash)
    const FETCH_TIMEOUT   = 8000;  // per-request abort timeout

    const overlayId = 'backendLoaderOverlay';

    // ─── DOM helpers ──────────────────────────────────────────────────────────
    function $id(id) { return document.getElementById(id); }

    function createOverlay() {
        if ($id(overlayId)) return;
        const overlay = document.createElement('div');
        overlay.id        = overlayId;
        overlay.className = 'backend-loader-overlay';
        overlay.innerHTML = `
            <div class="backend-loader-card">
                <div class="loader-brand">Library Management</div>
                <div class="loader-spinner" aria-hidden="true"></div>
                <div id="loaderMessage"    class="loader-message">Waking up server...</div>
                <div id="loaderSubMessage" class="loader-submessage">Connecting to backend</div>
                <div id="loaderDetails"   class="loader-details"></div>
                <div class="loader-actions">
                    <button id="loaderRetry" class="btn btn-outline hidden" type="button">Retry</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    function showOverlay() {
        createOverlay();
        $id(overlayId).classList.remove('hidden');
        document.documentElement.style.overflow = 'hidden';
    }

    function hideOverlay() {
        const o = $id(overlayId);
        if (!o) return;
        o.classList.add('fade-out');
        setTimeout(() => {
            if (o && o.parentNode) o.parentNode.removeChild(o);
            document.documentElement.style.overflow = '';
        }, 400);
    }

    function setMessage(text, subtext) {
        const m = $id('loaderMessage');
        const s = $id('loaderSubMessage');
        if (m) m.textContent = text;
        if (s && typeof subtext === 'string') s.textContent = subtext;
    }

    function setDetails(text) {
        const d = $id('loaderDetails');
        if (d) d.textContent = text;
    }

    function showRetryBtn() {
        const btn = $id('loaderRetry');
        if (btn) btn.classList.remove('hidden');
    }

    function hideRetryBtn() {
        const btn = $id('loaderRetry');
        if (btn) btn.classList.add('hidden');
    }

    // ─── Network helper ───────────────────────────────────────────────────────
    async function fetchWithTimeout(url, timeoutMs) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const t0 = performance.now();
        try {
            const resp = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
            const duration = Math.round(performance.now() - t0);
            clearTimeout(timer);
            return { resp, duration };
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    }

    // ─── Core wake-up routine ─────────────────────────────────────────────────
    function waitForBackend({ apiBase = (typeof API_URL !== 'undefined' ? API_URL : '/api') } = {}) {
        return new Promise((resolve, reject) => {
            const healthUrl    = apiBase.replace(/\/+$/, '') + '/health';
            const startTime    = Date.now();
            let   stopped      = false;   // guards against double-resolve/reject
            let   retryTimer   = null;    // current pending setTimeout handle
            let   intervalMs   = BASE_INTERVAL;

            console.log('[Bootstrap] Health check started →', healthUrl);
            showOverlay();
            setMessage('Waking up server...', 'Connecting to backend');
            hideRetryBtn();

            // ── Abort everything cleanly ──────────────────────────────────────
            function stop() {
                stopped = true;
                if (retryTimer !== null) {
                    clearTimeout(retryTimer);
                    retryTimer = null;
                    console.log('[Bootstrap] Polling stopped (interval cleared).');
                }
            }

            // ── Single attempt ────────────────────────────────────────────────
            async function attempt() {
                if (stopped) return;

                const elapsed = Date.now() - startTime;
                setDetails(`Elapsed: ${Math.round(elapsed / 1000)}s`);
                console.log(`[Bootstrap] Pinging backend… (elapsed ${Math.round(elapsed / 1000)}s)`);

                // Hard timeout guard
                if (elapsed >= MAX_TIMEOUT_MS) {
                    stop();
                    setMessage('Server unavailable', 'Could not reach backend within timeout');
                    setDetails('Please check your network or try again.');
                    showRetryBtn();
                    console.warn('[Bootstrap] Max timeout reached — giving up.');
                    return reject(new Error('Health check timeout'));
                }

                try {
                    const { resp, duration } = await fetchWithTimeout(healthUrl, FETCH_TIMEOUT);

                    // ── Parse JSON safely ─────────────────────────────────────
                    let json = null;
                    try { json = await resp.json(); } catch (_) { /* non-JSON body */ }

                    console.log(`[Bootstrap] Response: HTTP ${resp.status} in ${duration}ms`, json);

                    // ── SUCCESS: any 2xx with success:true ────────────────────
                    if (resp.ok && json && json.success) {
                        stop(); // ← clear timers FIRST

                        setMessage('Server is awake', 'Initializing application…');
                        setDetails(`Responded in ${duration}ms`);
                        hideRetryBtn();
                        console.log(`[Bootstrap] ✓ Backend healthy in ${duration}ms — initializing app.`);

                        // Honour minimum display time so the loader doesn't flash
                        const displayed = Date.now() - startTime;
                        const wait      = Math.max(0, MIN_DISPLAY_MS - displayed);

                        setTimeout(() => resolve(), wait); // resolve ASAP (wait ≤ 300ms)
                        return;
                    }

                    // Non-OK or unexpected body → fall through to retry
                    console.warn('[Bootstrap] Unexpected response — will retry.', { status: resp.status, json });

                } catch (err) {
                    // Network error / abort
                    console.warn('[Bootstrap] Request failed:', err.message || err);
                }

                if (stopped) return; // success arrived while we were in flight

                // ── Schedule next attempt with backoff ────────────────────────
                const elapsedNow = Date.now() - startTime;
                setDetails(`Retrying… (${Math.round(elapsedNow / 1000)}s elapsed)`);
                console.log(`[Bootstrap] Next retry in ${intervalMs}ms`);

                retryTimer = setTimeout(() => {
                    retryTimer = null;
                    attempt();
                }, intervalMs);

                // Grow interval with exponential backoff, capped at MAX_INTERVAL
                intervalMs = Math.min(Math.round(intervalMs * 1.25), MAX_INTERVAL);
            }

            // ── Retry button ──────────────────────────────────────────────────
            document.addEventListener('click', function onRetryClick(e) {
                if (!e.target || e.target.id !== 'loaderRetry') return;
                document.removeEventListener('click', onRetryClick);
                // Full page reload for a clean slate
                window.location.reload();
            });

            // ── Kick off the FIRST request immediately (no initial wait) ──────
            attempt();
        });
    }

    // ─── Boot sequence ────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('[Bootstrap] DOMContentLoaded — starting backend wake-up check.');

        try {
            await waitForBackend();

            console.log('[Bootstrap] Backend confirmed — calling initializeApp().');
            if (typeof window.initializeApp === 'function') {
                try {
                    await window.initializeApp();
                    console.log('[Bootstrap] initializeApp() completed successfully.');
                } catch (err) {
                    console.error('[Bootstrap] initializeApp() threw:', err);
                }
            }
        } catch (err) {
            // waitForBackend already shows the retry UI; nothing extra needed
            console.warn('[Bootstrap] Backend did not respond:', err.message || err);
        } finally {
            hideOverlay();
        }
    });

})();
