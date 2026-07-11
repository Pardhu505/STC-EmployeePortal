// fetchRetry.js
// Retries transient failures — network errors and 502/503/504 — which is exactly
// what a sleeping Render free-tier backend returns while it wakes up. 4xx/normal
// responses (e.g. 403 "no team") are returned as-is so callers can handle them.
export async function fetchWithRetry(url, opts = {}, tries = 4, delayMs = 1500) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.status >= 502 && res.status <= 504) {
        throw new Error(`server waking (${res.status})`);
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
