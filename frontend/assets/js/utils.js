/**
 * utils.js
 * Reusable utility functions: Toast, Modal, Loader, Format, Pagination,
 * and DOM helpers used across all pages.
 */

'use strict';

const Utils = (() => {

  // ═══════════════════════════════════════════════════════════════
  // TOAST NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════

  /** Ensure toast container exists */
  const getToastContainer = () => {
    let el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      el.className = 'toast-container';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Notifications');
      document.body.appendChild(el);
    }
    return el;
  };

  const TOAST_ICONS = {
    success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️',
  };

  /**
   * Show a toast notification.
   * @param {string} message   - Notification body text
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {string} [title]   - Optional bold title
   * @param {number} [duration]- Auto-dismiss ms (default: Config.TOAST_DURATION)
   */
  const toast = (message, type = 'info', title = '', duration = Config.TOAST_DURATION) => {
    const container = getToastContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${TOAST_ICONS[type] || 'ℹ️'}</span>
      <div>
        ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
        <div class="toast-msg">${escapeHtml(message)}</div>
      </div>
    `;
    container.appendChild(el);
    setTimeout(() => dismiss(el), duration);
  };

  const dismiss = (el) => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove());
  };

  // Shortcuts
  const toastSuccess = (msg, title) => toast(msg, 'success', title);
  const toastError   = (msg, title) => toast(msg, 'error',   title);
  const toastWarning = (msg, title) => toast(msg, 'warning',  title);
  const toastInfo    = (msg, title) => toast(msg, 'info',     title);

  // ═══════════════════════════════════════════════════════════════
  // MODAL
  // ═══════════════════════════════════════════════════════════════

  /**
   * Show a modal by its overlay ID.
   * @param {string} overlayId - ID of the .modal-overlay element
   */
  const openModal = (overlayId) => {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    overlay.setAttribute('aria-hidden', 'false');
    // Focus first focusable element
    const first = overlay.querySelector('button, input, select, textarea, a[href]');
    if (first) setTimeout(() => first.focus(), 50);
  };

  const closeModal = (overlayId) => {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    overlay.setAttribute('aria-hidden', 'true');
  };

  /** Generic confirmation dialog */
  const confirm = (message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      const overlayId = '_confirm-modal';
      let overlay = document.getElementById(overlayId);
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.className = 'modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
          <div class="modal" style="max-width:400px">
            <div class="modal-header">
              <h3 class="modal-title" id="${overlayId}-title">⚠️ ${escapeHtml(title)}</h3>
            </div>
            <div class="modal-body">
              <p id="${overlayId}-msg" style="color:var(--color-text-muted);font-size:var(--font-size-sm);"></p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" id="${overlayId}-cancel">Cancel</button>
              <button class="btn btn-danger" id="${overlayId}-ok">Confirm</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
      }
      overlay.querySelector(`#${overlayId}-title`).textContent = `⚠️ ${title}`;
      overlay.querySelector(`#${overlayId}-msg`).textContent   = message;

      const cleanup = (val) => {
        closeModal(overlayId);
        resolve(val);
      };
      overlay.querySelector(`#${overlayId}-ok`).onclick     = () => cleanup(true);
      overlay.querySelector(`#${overlayId}-cancel`).onclick = () => cleanup(false);
      overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
      openModal(overlayId);
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // PAGE LOADER
  // ═══════════════════════════════════════════════════════════════

  let _loaderEl = null;

  const showLoader = () => {
    if (_loaderEl) return;
    _loaderEl = document.createElement('div');
    _loaderEl.className = 'page-loader';
    _loaderEl.innerHTML = `
      <div class="spinner"></div>
      <p style="font-size:var(--font-size-sm);color:var(--color-text-muted);">Loading…</p>
    `;
    document.body.appendChild(_loaderEl);
  };

  const hideLoader = () => {
    if (_loaderEl) { _loaderEl.remove(); _loaderEl = null; }
  };

  // ═══════════════════════════════════════════════════════════════
  // BUTTON LOADING STATE
  // ═══════════════════════════════════════════════════════════════

  const setButtonLoading = (btn, loading, text = '') => {
    if (!btn) return;
    if (loading) {
      btn._originalText = btn.innerHTML;
      btn.classList.add('loading');
      btn.disabled = true;
      if (text) btn.querySelector('.btn-text') && (btn.querySelector('.btn-text').textContent = text);
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
      if (btn._originalText) btn.innerHTML = btn._originalText;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // FORMATTERS
  // ═══════════════════════════════════════════════════════════════

  /** Format ISO date string to human-readable */
  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const formatDateTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  /** Time ago — "3 hours ago" */
  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 1)   return 'Just now';
    if (min < 60)  return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24)   return `${hr} hour${hr > 1 ? 's' : ''} ago`;
    const d = Math.floor(hr / 24);
    if (d < 7)     return `${d} day${d > 1 ? 's' : ''} ago`;
    return formatDate(iso);
  };

  /** Capitalize first letter */
  const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

  /** Replace underscores with spaces and capitalize */
  const prettyStatus = (str) => str ? str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

  // ═══════════════════════════════════════════════════════════════
  // PAGINATION RENDERER
  // ═══════════════════════════════════════════════════════════════

  /**
   * Renders a pagination control.
   * @param {HTMLElement} container - Target element
   * @param {number} currentPage
   * @param {number} totalPages
   * @param {function} onPageChange - Called with new page number
   */
  const renderPagination = (container, currentPage, totalPages, onPageChange) => {
    if (!container || totalPages <= 1) { if (container) container.innerHTML = ''; return; }
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…');
      }
    }
    container.innerHTML = `
      <button class="page-btn" id="pg-prev" aria-label="Previous page" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
      ${pages.map((p) => p === '…'
        ? `<span class="page-btn" style="cursor:default;border:none">…</span>`
        : `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
      ).join('')}
      <button class="page-btn" id="pg-next" aria-label="Next page" ${currentPage === totalPages ? 'disabled' : ''}>›</button>
    `;
    container.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => onPageChange(parseInt(btn.dataset.page)));
    });
    container.querySelector('#pg-prev')?.addEventListener('click', () => onPageChange(currentPage - 1));
    container.querySelector('#pg-next')?.addEventListener('click', () => onPageChange(currentPage + 1));
  };

  // ═══════════════════════════════════════════════════════════════
  // STATUS / RISK BADGE BUILDERS
  // ═══════════════════════════════════════════════════════════════

  const statusChip = (status) => {
    const label = prettyStatus(status);
    return `<span class="status-chip status-${status}" role="status">${label}</span>`;
  };

  const riskBadge = (level) => {
    const r = Config.RISK_LABELS[level] || Config.RISK_LABELS.unknown;
    return `<span class="badge ${r.class}">${r.label}</span>`;
  };

  // ═══════════════════════════════════════════════════════════════
  // SECURITY HELPERS
  // ═══════════════════════════════════════════════════════════════

  /** Escape HTML to prevent XSS when injecting user content */
  const escapeHtml = (str) => {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // ═══════════════════════════════════════════════════════════════
  // DOM HELPERS
  // ═══════════════════════════════════════════════════════════════

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const show = (el) => { if (el) el.classList.remove('hidden'); };
  const hide = (el) => { if (el) el.classList.add('hidden'); };

  /** Render skeleton loader rows */
  const skeletonRows = (n = 4) =>
    Array.from({ length: n }, () =>
      `<div class="skeleton skeleton-line" style="width:${60 + Math.random() * 35}%;margin-bottom:10px;"></div>`
    ).join('');

  // ═══════════════════════════════════════════════════════════════
  // NAVBAR ACTIVE LINK HIGHLIGHTER
  // ═══════════════════════════════════════════════════════════════

  const highlightActiveNav = () => {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link, .sidebar-link, .admin-link').forEach((a) => {
      const href = a.getAttribute('href') || '';
      a.classList.toggle('active', href.endsWith(path) && href !== '#');
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // DROPDOWN TOGGLE
  // ═══════════════════════════════════════════════════════════════

  const initDropdowns = () => {
    document.querySelectorAll('.dropdown').forEach((dd) => {
      const trigger = dd.querySelector('[data-dropdown-trigger]');
      const menu    = dd.querySelector('.dropdown-menu');
      if (!trigger || !menu) return;
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // SIDEBAR TOGGLE (mobile)
  // ═══════════════════════════════════════════════════════════════

  const initSidebar = () => {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    const togglers = document.querySelectorAll('[data-sidebar-toggle]');
    if (!sidebar) return;
    togglers.forEach((btn) => {
      btn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open');
      });
    });
    if (overlay) overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // FAQ ACCORDION
  // ═══════════════════════════════════════════════════════════════

  const initFaqAccordion = () => {
    document.querySelectorAll('.faq-question').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        item.classList.toggle('open');
      });
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // COUNTER ANIMATION
  // ═══════════════════════════════════════════════════════════════

  const animateCounter = (el, target, duration = 2000) => {
    let start = 0;
    const step = () => {
      start += Math.ceil(target / (duration / 16));
      el.textContent = Math.min(start, target).toLocaleString('en-IN');
      if (start < target) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // ═══════════════════════════════════════════════════════════════
  // FILE SIZE VALIDATOR
  // ═══════════════════════════════════════════════════════════════

  const validateFile = (file, allowedTypes) => {
    if (!allowedTypes.includes(file.type)) {
      return `File type "${file.type}" is not allowed.`;
    }
    if (file.size > Config.MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File "${file.name}" exceeds ${Config.MAX_FILE_SIZE_MB}MB limit.`;
    }
    return null;
  };

  // ─── Public API ────────────────────────────────────────────────
  return {
    toast, toastSuccess, toastError, toastWarning, toastInfo,
    openModal, closeModal, confirm,
    showLoader, hideLoader,
    setButtonLoading,
    formatDate, formatDateTime, timeAgo,
    capitalize, prettyStatus,
    renderPagination,
    statusChip, riskBadge,
    escapeHtml,
    $, $$, show, hide,
    skeletonRows,
    highlightActiveNav,
    initDropdowns,
    initSidebar,
    initFaqAccordion,
    animateCounter,
    validateFile,
  };
})();
