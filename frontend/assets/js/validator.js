/**
 * validator.js
 * Client-side form validation with accessible error display.
 */

'use strict';

const Validator = (() => {

  // ─── Rules ────────────────────────────────────────────────────

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_REGEX = /^(\+91|0)?[6-9]\d{9}$/;
  const UUID_REGEX  = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // ─── Error display helpers ────────────────────────────────────

  /** Show error under a field */
  const showError = (input, message) => {
    input.classList.add('error');
    let err = input.parentElement.querySelector('.form-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'form-error';
      input.parentElement.appendChild(err);
    }
    err.innerHTML = `<span aria-hidden="true">⚠</span> ${Utils.escapeHtml(message)}`;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', err.id || (err.id = `err-${Date.now()}`));
  };

  const clearError = (input) => {
    input.classList.remove('error');
    input.removeAttribute('aria-invalid');
    const err = input.parentElement?.querySelector('.form-error');
    if (err) err.remove();
  };

  const clearAllErrors = (form) => {
    form.querySelectorAll('.form-control.error').forEach(clearError);
  };

  // ─── Core validator ───────────────────────────────────────────

  /**
   * Validate a form against a schema.
   * @param {HTMLFormElement} form
   * @param {object} schema - { fieldName: { rules: [], label: '' } }
   * @returns {{ valid: boolean, errors: object }}
   */
  const validate = (form, schema) => {
    clearAllErrors(form);
    const errors = {};

    for (const [name, config] of Object.entries(schema)) {
      const input = form.querySelector(`[name="${name}"]`) || form.querySelector(`#${name}`);
      if (!input) continue;
      const value = input.value.trim();

      for (const rule of config.rules) {
        let message = null;

        if (rule.required && !value) {
          message = `${config.label || name} is required.`;
        } else if (value && rule.minLength && value.length < rule.minLength) {
          message = `${config.label} must be at least ${rule.minLength} characters.`;
        } else if (value && rule.maxLength && value.length > rule.maxLength) {
          message = `${config.label} must be no more than ${rule.maxLength} characters.`;
        } else if (value && rule.email && !EMAIL_REGEX.test(value)) {
          message = 'Please enter a valid email address.';
        } else if (value && rule.phone && !PHONE_REGEX.test(value)) {
          message = 'Please enter a valid Indian mobile number.';
        } else if (value && rule.min !== undefined && Number(value) < rule.min) {
          message = `Minimum value is ${rule.min}.`;
        } else if (value && rule.max !== undefined && Number(value) > rule.max) {
          message = `Maximum value is ${rule.max}.`;
        } else if (value && rule.pattern && !rule.pattern.test(value)) {
          message = rule.patternMessage || `${config.label} format is invalid.`;
        } else if (rule.custom) {
          message = rule.custom(value, form);
        }

        if (message) {
          errors[name] = message;
          showError(input, message);
          break; // Only show first error per field
        }
      }
    }

    const firstError = form.querySelector('.form-control.error');
    if (firstError) firstError.focus();

    return { valid: Object.keys(errors).length === 0, errors };
  };

  // ─── Pre-built schemas ────────────────────────────────────────

  const schemas = {
    login: {
      full_name: {
        label: 'Full Name',
        rules: [{ required: true }, { minLength: 2 }],
      },
      email: {
        label: 'Email',
        rules: [{ required: true }, { email: true }],
      },
    },
    report: {
      incident_type: { label: 'Incident Type',  rules: [{ required: true }] },
      victim_type:   { label: 'Victim Type',    rules: [{ required: true }] },
      description:   { label: 'Description',    rules: [{ required: true }, { minLength: 20 }] },
      incident_date: { label: 'Incident Date',  rules: [{ required: true }] },
    },
    profile: {
      full_name: { label: 'Full Name', rules: [{ required: true }, { minLength: 2 }] },
      phone:     { label: 'Phone',     rules: [{ phone: true }] },
    },
    contact: {
      name:    { label: 'Name',    rules: [{ required: true }, { minLength: 2 }] },
      email:   { label: 'Email',   rules: [{ required: true }, { email: true }] },
      subject: { label: 'Subject', rules: [{ required: true }] },
      message: { label: 'Message', rules: [{ required: true }, { minLength: 10 }] },
    },
  };

  // ─── Live validation (on blur) ────────────────────────────────

  const attachLiveValidation = (form, schema) => {
    for (const [name, config] of Object.entries(schema)) {
      const input = form.querySelector(`[name="${name}"]`) || form.querySelector(`#${name}`);
      if (!input) continue;
      input.addEventListener('blur', () => {
        // Re-validate only this field on blur
        const singleSchema = { [name]: config };
        validate({ querySelector: (sel) => form.querySelector(sel), querySelectorAll: (sel) => form.querySelectorAll(sel) }, singleSchema);
      });
      input.addEventListener('input', () => clearError(input));
    }
  };

  // ─── Sanitize input ───────────────────────────────────────────

  /** Basic input sanitization to strip script tags etc. */
  const sanitize = (str) => {
    if (!str) return '';
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  };

  return {
    validate,
    schemas,
    showError, clearError, clearAllErrors,
    attachLiveValidation,
    sanitize,
    EMAIL_REGEX, PHONE_REGEX,
  };
})();
