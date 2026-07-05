/**
 * api.js
 * Centralized Fetch API wrapper.
 * Handles: JWT injection, auto-refresh, loading state, error normalization.
 * Every backend call in the app must go through this module.
 */

'use strict';

const Api = (() => {

  // ─── Internal helpers ─────────────────────────────────────────
  const getAccessToken  = () => localStorage.getItem(Config.ACCESS_TOKEN_KEY);
  const getRefreshToken = () => localStorage.getItem(Config.REFRESH_TOKEN_KEY);

  const setTokens = (access, refresh) => {
    if (access)  localStorage.setItem(Config.ACCESS_TOKEN_KEY, access);
    if (refresh) localStorage.setItem(Config.REFRESH_TOKEN_KEY, refresh);
  };

  const clearTokens = () => {
    localStorage.removeItem(Config.ACCESS_TOKEN_KEY);
    localStorage.removeItem(Config.REFRESH_TOKEN_KEY);
    localStorage.removeItem(Config.USER_KEY);
  };

  /** Whether a token refresh is in flight (prevents cascading refresh calls) */
  let _refreshing = false;
  let _refreshQueue = [];

  const processQueue = (error, token) => {
    _refreshQueue.forEach(({ resolve, reject }) =>
      error ? reject(error) : resolve(token)
    );
    _refreshQueue = [];
  };

  // ─── Token refresh ─────────────────────────────────────────────

  const refreshAccessToken = async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available.');

    const res = await fetch(`${Config.API_BASE}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // Refresh failed — force logout
      clearTokens();
      window.location.href = '/login.html';
      throw new Error('Session expired. Please login again.');
    }

    const data = await res.json();
    const newAccess  = data.data?.accessToken;
    const newRefresh = data.data?.refreshToken;
    setTokens(newAccess, newRefresh);
    return newAccess;
  };

  // ─── Core request function ─────────────────────────────────────

  /**
   * Makes an HTTP request to the API.
   * @param {string} endpoint - Relative path e.g. '/auth/send-otp'
   * @param {object} options  - fetch options (method, body, etc.)
   * @param {boolean} auth    - Whether to send Authorization header
   * @returns {Promise<object>} Parsed response body
   */
  const request = async (endpoint, options = {}, auth = true) => {
    const url = `${Config.API_BASE}${endpoint}`;
    const headers = { ...(options.headers || {}) };

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (auth) {
      const token = getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = { ...options, headers };
    if (fetchOptions.body && typeof fetchOptions.body === 'object' && !(fetchOptions.body instanceof FormData)) {
      fetchOptions.body = JSON.stringify(fetchOptions.body);
    }

    let response = await fetch(url, fetchOptions);

    // ── Handle 401 with token refresh ──────────────────────────
    if (response.status === 401 && auth) {
      if (_refreshing) {
        // Queue subsequent calls while refresh is in flight
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          headers['Authorization'] = `Bearer ${newToken}`;
          return fetch(url, { ...fetchOptions, headers }).then(normalizeResponse);
        });
      }

      _refreshing = true;
      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, { ...fetchOptions, headers });
      } catch (err) {
        processQueue(err, null);
        throw err;
      } finally {
        _refreshing = false;
      }
    }

    return normalizeResponse(response);
  };

  // ─── Response normalizer ───────────────────────────────────────

  const normalizeResponse = async (response) => {
    let body;
    const contentType = response.headers.get('content-type') || '';

    try {
      body = contentType.includes('application/json')
        ? await response.json()
        : { message: await response.text() };
    } catch {
      body = { message: 'Unexpected server response.' };
    }

    if (!response.ok) {
      const err = new Error(body.message || `Request failed with status ${response.status}`);
      err.status = response.status;
      err.data   = body;
      throw err;
    }

    return body;
  };

  // ─── Convenience methods ───────────────────────────────────────

  const get    = (endpoint, auth = true)              => request(endpoint, { method: 'GET' }, auth);
  const post   = (endpoint, body, auth = true)        => request(endpoint, { method: 'POST',  body }, auth);
  const put    = (endpoint, body, auth = true)        => request(endpoint, { method: 'PUT',   body }, auth);
  const del    = (endpoint, auth = true)              => request(endpoint, { method: 'DELETE' }, auth);
  const upload = (endpoint, formData, auth = true)    => request(endpoint, { method: 'POST', body: formData }, auth);

  // ─── Public API ────────────────────────────────────────────────
  return {
    get, post, put, delete: del, upload,
    setTokens, clearTokens, getAccessToken, getRefreshToken,
    request,
  };
})();
