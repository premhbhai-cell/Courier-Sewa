
(function () {
  'use strict';
  const USERS_KEY = 'courierSewaDemoUsers';
  const SESSION_KEY = 'courierSewaDemoSession';
  const isDashboard = /\/dashboard\/index\.html$/.test(location.pathname);

  function readUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
    catch (_) { return {}; }
  }
  async function hashPassword(password) {
    if (!window.crypto || !crypto.subtle) throw new Error('Secure password hashing is unavailable. Open this site using HTTPS.');
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function showMessage(form, message, type) {
    let box = form.querySelector('.cs-auth-message');
    if (!box) {
      box = document.createElement('div');
      box.className = 'cs-auth-message';
      box.style.cssText = 'padding:12px 14px;border-radius:9px;margin:0 0 16px;font-size:14px;line-height:1.5;';
      form.prepend(box);
    }
    box.textContent = message;
    box.style.background = type === 'success' ? '#ecfdf5' : '#fef2f2';
    box.style.color = type === 'success' ? '#047857' : '#b91c1c';
    box.style.border = '1px solid ' + (type === 'success' ? '#a7f3d0' : '#fecaca');
  }
  function goDashboard() {
    location.href = '../dashboard/index.html';
  }
  function setupRegister() {
    const form = document.getElementById('registerForm');
    if (!form) return;
    form.action = '#';
    form.removeAttribute('enctype');
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const data = new FormData(form);
      const company = String(data.get('company_name') || '').trim();
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim().toLowerCase();
      const phone = String(data.get('phone') || '').trim();
      const password = String(data.get('password') || '');
      const confirm = String(data.get('password_confirmation') || '');
      const plan = String(data.get('plan_id') || '');
      if (!company || !name || !email || !password || !plan) return showMessage(form, 'Please fill all required fields and select a plan.', 'error');
      if (password.length < 8) return showMessage(form, 'Password must be at least 8 characters.', 'error');
      if (password !== confirm) return showMessage(form, 'Password and Confirm Password do not match.', 'error');
      const users = readUsers();
      if (users[email]) return showMessage(form, 'This email already has an account. Please log in.', 'error');
      const button = form.querySelector('[type="submit"]');
      if (button) { button.disabled = true; button.dataset.oldText = button.textContent; button.textContent = 'Creating account...'; }
      try {
        users[email] = {
          company_name: company, name: name, email: email, phone: phone,
          referral_code: String(data.get('referral_code') || ''),
          plan_id: plan, password_hash: await hashPassword(password),
          created_at: new Date().toISOString()
        };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: email, name: name, company_name: company, logged_in_at: Date.now() }));
        showMessage(form, 'Account created successfully. Opening your dashboard...', 'success');
        setTimeout(goDashboard, 650);
      } catch (error) {
        showMessage(form, error.message || 'Could not create account in this browser.', 'error');
      } finally {
        if (button) { button.disabled = false; button.textContent = button.dataset.oldText || 'Create Account'; }
      }
    });
  }
  function setupLogin() {
    const forms = Array.from(document.querySelectorAll('form')).filter(f => f.querySelector('[name="email"]') && f.querySelector('[name="password"]') && f.id !== 'confirm-device-form');
    const form = forms[0];
    if (!form) return;
    form.action = '#';
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const data = new FormData(form);
      const email = String(data.get('email') || '').trim().toLowerCase();
      const password = String(data.get('password') || '');
      const user = readUsers()[email];
      if (!user) return showMessage(form, 'Account not found on this browser. Please create an account first.', 'error');
      try {
        const hash = await hashPassword(password);
        if (hash !== user.password_hash) return showMessage(form, 'Incorrect email or password.', 'error');
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: user.email, name: user.name, company_name: user.company_name, logged_in_at: Date.now() }));
        showMessage(form, 'Login successful. Opening your dashboard...', 'success');
        setTimeout(goDashboard, 500);
      } catch (error) {
        showMessage(form, error.message || 'Login failed.', 'error');
      }
    });
  }
  function setupDashboard() {
    let session = null;
    try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (_) {}
    if (!session || !session.email) {
      location.replace('../pages/login.html');
      return;
    }
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.textContent = 'Logout';
    logout.setAttribute('aria-label', 'Logout');
    logout.style.cssText = 'position:fixed;right:18px;top:18px;z-index:1000000;background:#f5c518;color:#111;border:0;border-radius:8px;padding:10px 16px;font-weight:700;box-shadow:0 3px 12px #0002;cursor:pointer;';
    logout.addEventListener('click', function () {
      sessionStorage.removeItem(SESSION_KEY);
      location.replace('../pages/login.html');
    });
    document.body.appendChild(logout);
  }
  if (isDashboard) setupDashboard();
  else if (/\/pages\/register\.html$/.test(location.pathname)) {
    try { const active = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); if (active && active.email) { goDashboard(); return; } } catch (_) {}
    setupRegister();
  }
  else if (/\/pages\/login\.html$/.test(location.pathname)) {
    try { const active = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); if (active && active.email) { goDashboard(); return; } } catch (_) {}
    setupLogin();
  }
})();
