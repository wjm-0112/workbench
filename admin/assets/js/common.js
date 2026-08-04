/* B 端后台 · 公共能力：API、鉴权、主题、Toast、模态、路由 */
(function () {
  const Admin = (window.Admin = window.Admin || {});
  const TOKEN_KEY = 'pwb_admin_token';

  // ---------- 鉴权 ----------
  Admin.getToken = () => localStorage.getItem(TOKEN_KEY) || '';
  Admin.setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));
  Admin.redirectLogin = () => (location.href = 'login.html');

  // ---------- API ----------
  Admin.api = async function (path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const token = Admin.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch('/api' + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (res.status === 401) {
      Admin.setToken('');
      Admin.redirectLogin();
      throw new Error('未登录');
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || '请求失败');
    return data;
  };

  // ---------- 工具 ----------
  Admin.esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  Admin.fmtDate = (s) => (s ? s.slice(0, 10) : '-');

  // ---------- Toast ----------
  Admin.toast = function (msg, type = '') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  };

  // ---------- 模态 ----------
  Admin.modal = function (title, bodyHtml, onOk) {
    document.querySelectorAll('.modal-mask').forEach((m) => m.remove());
    const mask = document.createElement('div');
    mask.className = 'modal-mask show';
    mask.innerHTML = `<div class="modal"><div class="m-head">${Admin.esc(title)}</div><div class="m-body">${bodyHtml}</div><div class="m-foot"><button class="btn" data-x>取消</button><button class="btn primary" data-ok>确定</button></div></div>`;
    document.body.appendChild(mask);
    mask.querySelector('[data-x]').onclick = () => mask.remove();
    mask.querySelector('[data-ok]').onclick = () => {
      if (onOk && onOk(mask) === false) return;
      mask.remove();
    };
    mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });
    return mask;
  };

  // ---------- 主题 ----------
  Admin.applyTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('pwb_admin_theme', t);
  };
  Admin.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    Admin.applyTheme(cur);
    return cur;
  };

  // ---------- 路由 / 外壳 ----------
  const SECTIONS = (Admin.sections = {});
  Admin.register = function (key, def) { SECTIONS[key] = def; };

  Admin.boot = function () {
    if (!Admin.getToken()) return Admin.redirectLogin();
    Admin.applyTheme(localStorage.getItem('pwb_admin_theme') || 'light');

    // 侧栏
    const nav = document.getElementById('nav');
    nav.innerHTML = Object.keys(SECTIONS)
      .map((k) => `<a data-k="${k}"><span class="ico">${SECTIONS[k].icon || '•'}</span><span>${SECTIONS[k].title}</span></a>`)
      .join('');
    nav.querySelectorAll('a').forEach((a) =>
      (a.onclick = () => { location.hash = a.dataset.k; })
    );

    // 顶栏
    document.getElementById('logout').onclick = async () => {
      try { await Admin.api('/auth/logout', { method: 'POST' }); } catch (e) {}
      Admin.setToken('');
      Admin.redirectLogin();
    };
    document.getElementById('themeBtn').onclick = () => Admin.toggleTheme();

    // 当前用户
    Admin.api('/auth/me')
      .then((d) => { document.getElementById('who').textContent = d.user.displayName + '（' + d.user.role + '）'; })
      .catch(() => {});

    const route = () => {
      const key = (location.hash || '').slice(1) || Object.keys(SECTIONS)[0];
      const def = SECTIONS[key] || SECTIONS[Object.keys(SECTIONS)[0]];
      document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.k === key));
      document.getElementById('pageTitle').textContent = def.title;
      const el = document.getElementById('page');
      el.innerHTML = '';
      try { def.render(el); } catch (e) { el.innerHTML = '<div class="empty">加载失败：' + Admin.esc(e.message) + '</div>'; }
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', route);
    route();
  };

  // 自动引导（脚本置于 body 末尾，注册已完成）
  if (document.readyState !== 'loading') Admin.boot();
  else document.addEventListener('DOMContentLoaded', () => Admin.boot());
})();
