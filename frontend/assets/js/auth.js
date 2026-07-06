/**
 * auth.js
 * Auth state management module.
 * Handles: login state, user session, route guards, logout.
 */

'use strict';

const Auth = (() => {

  // ─── Session Accessors ────────────────────────────────────────

  const getUser = () => {
    try {
      const raw = localStorage.getItem(Config.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const setUser = (user) => {
    if (user) localStorage.setItem(Config.USER_KEY, JSON.stringify(user));
  };

  const isLoggedIn = () => !!Api.getAccessToken() && !!getUser();

  const isAdmin = () => {
    const user = getUser();
    return user && (user.role === 'admin' || user.role === 'super_admin');
  };

  // ─── Route Guards ─────────────────────────────────────────────

  /** Call on every protected page. Redirects to login if not authenticated. */
  const requireAuth = (redirectTo = 'login.html') => {
    if (!isLoggedIn()) {
      sessionStorage.setItem('redirect_after_login', window.location.href);
      const path = window.location.pathname;
      if (path.includes('/admin/')) {
        window.location.href = '../login.html';
      } else {
        window.location.href = redirectTo;
      }
      return false;
    }
    return true;
  };

  /** Call on every admin-only page. */
  const requireAdmin = () => {
    if (!isLoggedIn()) {
      const path = window.location.pathname;
      if (path.includes('/admin/')) {
        window.location.href = 'login.html';
      } else {
        window.location.href = 'admin/login.html';
      }
      return false;
    }
    if (!isAdmin()) {
      Utils.toastError('You do not have permission to access this page.');
      const path = window.location.pathname;
      if (path.includes('/admin/')) {
        window.location.href = '../dashboard.html';
      } else {
        window.location.href = 'dashboard.html';
      }
      return false;
    }
    return true;
  };

  /** Redirect logged-in users away from login page */
  const redirectIfLoggedIn = (to = 'dashboard.html') => {
    if (isLoggedIn()) window.location.href = to;
  };

  // ─── Auth API calls ───────────────────────────────────────────

  /** Step 1: Send OTP to email */
  const sendOtp = async (email, name = '') => {
    return Api.post('/auth/send-otp', { email, name }, false);
  };

  /** Step 2: Verify OTP and store tokens */
  const verifyOtp = async (email, otp) => {
    const data = await Api.post('/auth/verify-otp', { email, otp }, false);
    const { token, refreshToken, user } = data.data || {};
    const accessToken = token;
    if (!accessToken) throw new Error('Authentication failed. No token received.');
    Api.setTokens(accessToken, refreshToken);
    setUser(user);
    return user;
  };

  /** Logout — revokes token on backend, clears local state */
  const logout = async () => {
    try {
      await Api.post('/auth/logout', {});
    } catch { /* ignore network errors on logout */ }
    Api.clearTokens();
    localStorage.removeItem(Config.USER_KEY);
    window.location.href = 'login.html';
  };

  /** Populate user info into navbar elements */
  const populateNavUser = () => {
    const user = getUser();
    if (!user) return;

    const nameEl   = document.getElementById('nav-user-name');
    const avatarEl = document.getElementById('nav-user-avatar');
    const initials = (user.full_name || user.email || 'U')
      .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

    if (nameEl)   nameEl.textContent = user.full_name || user.email?.split('@')[0] || 'User';
    if (avatarEl) {
      avatarEl.innerHTML = user.avatar_url
        ? `<img src="${Utils.escapeHtml(user.avatar_url)}" alt="${Utils.escapeHtml(initials)}">`
        : initials;
    }
  };

  // ─── Public API ───────────────────────────────────────────────
  return {
    getUser, setUser,
    isLoggedIn, isAdmin,
    requireAuth, requireAdmin, redirectIfLoggedIn,
    sendOtp, verifyOtp, logout,
    populateNavUser,
  };
})();
