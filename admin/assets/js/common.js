/* 管理台 · 公共能力：解锁校验、主题、Toast、模态、路由（纯前端，读本地加密数据） */
(function () {
  const Admin = (window.Admin = window.Admin || {});

  /* ---------- 解锁校验（与 C 端同一加密 localStorage） ---------- */
  Admin.requireUnlocked = async function () {
    if (await PB.restore()) return true;
    if (PB.isUnlocked()) return true;
    location.href = 'login.html';
    return false;
  };
  Admin.logout = function () { PB.lock(); location.href = 'login.html'; };

  /* ---------- 数据访问（本地） ---------- */
  Admin.data = () => PB.getData();
  Admin.config = () => PB.getConfig();

  /* ---------- 工具 ---------- */
  Admin.esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  Admin.fmtDate = (s) => (s ? s.slice(0, 10) : '-');

  /* ---------- Toast ---------- */
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

  /* ---------- 模态 ---------- */
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

  /* ---------- 主题（管理台独立外观） ---------- */
  Admin.applyTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('pwb_admin_theme', t);
  };
  Admin.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    Admin.applyTheme(cur);
    return cur;
  };

  /* ---------- 路由 / 外壳 ---------- */
  const SECTIONS = (Admin.sections = {});
  Admin.register = function (key, def) { SECTIONS[key] = def; };

  Admin.boot = async function () {
    if (!(await Admin.requireUnlocked())) return;
    Admin.applyTheme(localStorage.getItem('pwb_admin_theme') || (Admin.config().theme && Admin.config().theme.mode) || 'light');

    const nav = document.getElementById('nav');
    nav.innerHTML = Object.keys(SECTIONS)
      .map((k) => `<a data-k="${k}"><span class="ico">${SECTIONS[k].icon || '•'}</span><span>${SECTIONS[k].title}</span></a>`)
      .join('');
    nav.querySelectorAll('a').forEach((a) => (a.onclick = () => { location.hash = a.dataset.k; }));

    document.getElementById('logout').onclick = () => Admin.logout();
    document.getElementById('themeBtn').onclick = () => Admin.toggleTheme();
    document.getElementById('who').textContent = (Admin.config().profile && Admin.config().profile.userName) || '我';

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

  if (document.readyState !== 'loading') Admin.boot();
  else document.addEventListener('DOMContentLoaded', () => Admin.boot());
})();
