/* 管理台 · 公共能力：解锁校验、主题、Toast、模态、路由（纯前端，读本地加密数据） */
(function () {
  const Admin = (window.Admin = window.Admin || {});

  /* ---------- 统一描边 SVG 图标（与 C 端共用视觉风格） ---------- */
  Admin.ICON = {
    dashboard:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20v-7M9 20V5M14 20v-9M19 20v-4" stroke-linecap="round"/><path d="M2 20h20"/></svg>',
    data:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
    users:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5a3 3 0 0 1 0 6M21 20c0-2.5-1.5-4.6-3.5-5.5"/></svg>',
    cloud:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A3.5 3.5 0 0 1 18 18z"/></svg>',
    config:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
    about:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" stroke-linecap="round"/></svg>',
    shield:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trend:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 7-7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 8h6v6"/></svg>',
    calendar:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
    tag:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/></svg>',
    image:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>',
    sync:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-15 6.7L3 16" stroke-linecap="round"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8" stroke-linecap="round"/><path d="M21 4v4h-4M3 20v-4h4"/></svg>',
    download:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 11l5 5 5-5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 21h16"/></svg>',
    trash:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    edit:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9l-4-4L4 16z" stroke-linejoin="round"/><path d="M14 6l4 4"/></svg>',
    plus:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>',
    search:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg>',
    list:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    flag:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V4h11l-2 4 2 4H5" stroke-linejoin="round"/></svg>',
    coins:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
    lock:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };

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
      .map((k) => {
        const raw = SECTIONS[k].icon;
        const ic = Admin.ICON[raw] || (raw ? Admin.esc(raw) : '•');
        return `<a data-k="${k}"><span class="ico">${ic}</span><span>${Admin.esc(SECTIONS[k].title)}</span></a>`;
      })
      .join('')
      + '<div class="nav-div"></div>'
      + `<a class="nav-c" href="../index.html"><span class="ico">${Admin.ICON.grid}</span><span>工作台（C 端）</span></a>`;
    nav.querySelectorAll('a[data-k]').forEach((a) => (a.onclick = () => { location.hash = a.dataset.k; }));

    /* 侧栏折叠（桌面）/ 抽屉（移动端） */
    const shell = document.querySelector('.shell');
    const navToggle = document.getElementById('navToggle');
    const overlay = document.getElementById('drawerOverlay');
    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
    const syncShellAttr = () => {
      if (isMobile()) shell.removeAttribute('data-collapsed');
      else shell.removeAttribute('data-drawer');
    };
    navToggle.onclick = () => {
      if (isMobile()) {
        if (shell.hasAttribute('data-drawer')) shell.removeAttribute('data-drawer');
        else shell.setAttribute('data-drawer', '');
      } else {
        if (shell.hasAttribute('data-collapsed')) shell.removeAttribute('data-collapsed');
        else shell.setAttribute('data-collapsed', '');
      }
    };
    if (overlay) overlay.onclick = () => shell.removeAttribute('data-drawer');
    window.addEventListener('resize', syncShellAttr);
    syncShellAttr();

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
