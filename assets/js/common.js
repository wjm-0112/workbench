/* ===== 个人工作台 · 公共 UI（密码门/动态导航/双主题/Toast） ===== */
const PBUI = (function () {
  const PAGE_HREF = { dashboard: 'index.html', tasks: 'tasks.html', notes: 'notes.html', snippets: 'snippets.html', profile: 'profile.html' };

  const ICON = {
    grid:  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
    check: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h12M4 12h12M4 18h8"/><path d="M19 5l-2 2 2 2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    note:  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h11l4 4v14H5z"/><path d="M9 9h7M9 13h7M9 17h4"/></svg>',
    book:  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M19 3v16"/></svg>',
    user:  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    config:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
    link:  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 14a4 4 0 0 0 6 .5l2-2a4 4 0 0 0-5.7-5.7L11 8"/><path d="M14 10a4 4 0 0 0-6-.5l-2 2a4 4 0 0 0 5.7 5.7L13 16"/></svg>',
    star:  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z"/></svg>',
    sun:   '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>',
    moon:  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>',
    news:  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h7M7 16h9"/></svg>',
    cart:  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h2l2.4 12h11L21 7H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg>'
  };

  function brandMark() {
    return `<svg class="brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="7" fill="var(--primary,#1E3A8A)"/>
      <rect x="9" y="9" width="14" height="4" rx="2" fill="#fff"/>
      <rect x="9" y="15" width="14" height="4" rx="2" fill="#fff" opacity="0.7"/>
      <rect x="9" y="21" width="9" height="4" rx="2" fill="#fff" opacity="0.5"/>
    </svg>`;
  }

  function getNav() {
    const cfg = PB.getConfig();
    return (cfg.modules || []).filter(m => m.enabled !== false).slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(m => {
      let href = m.href;
      if (m.type === 'page' || !m.type) href = PAGE_HREF[m.key] || (m.href || '#');
      return { key: m.key, label: m.label || m.key, icon: m.icon || 'grid', type: m.type || 'page', href, core: !!m.core };
    });
  }

  function themeIcon() {
    const mode = (PB.getConfig().theme && PB.getConfig().theme.mode) || 'light';
    return mode === 'dark' ? ICON.sun : ICON.moon;
  }

  function renderChrome(current) {
    const nav = getNav();
    const siteName = esc(PB.getConfig().siteName || '我的工作台');
    const brand = `<a class="brand" href="index.html">${brandMark()}<span>${siteName}</span></a>`;
    const sb = document.getElementById('sidebar');
    if (sb) {
      sb.innerHTML = brand + nav.map(n => {
        const cls = n.type === 'link' ? 'nav-item ext' : 'nav-item';
        const tgt = n.type === 'link' ? ' target="_blank" rel="noopener"' : '';
        const active = n.key === current ? ' active' : '';
        return `<a class="${cls}${active}" href="${esc(n.href)}"${tgt}><span class="ico">${ICON[n.icon] || ICON.grid}</span><span>${esc(n.label)}</span></a>`;
      }).join('');
    }
    const tb = document.getElementById('topbar');
    if (tb) {
      tb.innerHTML = `${brand}<div class="topbar-right">
        <button class="icon-btn" id="theme-toggle" title="切换深浅色" aria-label="切换深浅色">${themeIcon()}</button>
      </div>`;
      const tbtn = tb.querySelector('#theme-toggle');
      if (tbtn) tbtn.addEventListener('click', toggleTheme);
    }
    const bar = document.getElementById('tabbar');
    if (bar) {
      const mobile = nav.filter(n => n.key !== 'profile').slice(0, 4);
      const prof = nav.find(n => n.key === 'profile');
      const list = prof ? mobile.concat([prof]) : mobile;
      bar.innerHTML = list.map(n => {
        const tgt = n.type === 'link' ? ' target="_blank" rel="noopener"' : '';
        const active = n.key === current ? ' active' : '';
        return `<a class="tab-item${active}" href="${esc(n.href)}"${tgt}><span class="ico">${ICON[n.icon] || ICON.grid}</span><span>${esc(n.label)}</span></a>`;
      }).join('');
    }
  }

  /* ---------- 双主题 ---------- */
  function applyTheme(theme) {
    theme = theme || PB.getConfig().theme;
    const pal = (theme && theme[theme.mode]) || (theme && theme.light) || {};
    const root = document.documentElement;
    Object.keys(pal).forEach(k => root.style.setProperty('--' + k, pal[k]));
    if (theme && theme.fontTitle) root.style.setProperty('--font-title', theme.fontTitle);
    if (theme && theme.fontBody) root.style.setProperty('--font-body', theme.fontBody);
    if (theme && theme.mode === 'dark') root.classList.add('theme-dark'); else root.classList.remove('theme-dark');
  }
  async function toggleTheme() {
    const c = PB.getConfig();
    c.theme.mode = c.theme.mode === 'dark' ? 'light' : 'dark';
    PB.setConfig(c);
    applyTheme(c.theme);
    const tbtn = document.getElementById('theme-toggle');
    if (tbtn) tbtn.innerHTML = themeIcon();
    toast('已切换为' + (c.theme.mode === 'dark' ? '深色' : '浅色'));
  }

  let toastEl = null;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function secureContextOK() { return typeof crypto !== 'undefined' && crypto.subtle; }

  function showGate() {
    return new Promise(resolve => {
      if (!secureContextOK()) {
        const g = document.createElement('div'); g.className = 'gate';
        g.innerHTML = `<div class="gate-box"><h1>打不开 😢</h1><p>浏览器在「直接双击文件」时禁用了加密功能。<br>请改用：<br>① 部署到 GitHub Pages（https）后打开；或<br>② 本地用 <b>python -m http.server</b> 起服务，访问 http://localhost:8000</p></div>`;
        document.body.appendChild(g); resolve(false); return;
      }
      const first = !PB.hasLocal();
      const gate = document.createElement('div'); gate.className = 'gate';
      gate.innerHTML = `<div class="gate-box">
        ${brandMark()}
        <h1>${esc(PB.getConfig().siteName || '我的工作台')}</h1>
        <p>${first ? '第一次来～先设个访问密码（用来加密你的数据）' : '欢迎回来，请输入访问密码'}</p>
        <input type="password" id="gate-pw" placeholder="输入密码" autocomplete="off">
        ${first ? '<input type="password" id="gate-pw2" placeholder="再输一次确认" autocomplete="off" style="margin-top:8px;">' : ''}
        <button class="btn btn-primary btn-block" id="gate-go" style="margin-top:14px;">${first ? '设定并进入' : '解锁'}</button>
        <div class="gate-err" id="gate-err"></div>
      </div>`;
      document.body.appendChild(gate);
      const pw = gate.querySelector('#gate-pw'); pw.focus();
      const err = () => gate.querySelector('#gate-err');
      async function go() {
        const p = pw.value;
        if (!p) { err().textContent = '密码不能为空'; return; }
        if (first && p !== gate.querySelector('#gate-pw2').value) { err().textContent = '两次输入不一致'; return; }
        const r = await PB.unlock(p);
        if (r === 'wrong') { err().textContent = '密码错误，请重试'; return; }
        gate.remove(); resolve(true);
      }
      gate.querySelector('#gate-go').addEventListener('click', go);
      pw.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
  }

  async function ensureUnlocked() {
    if (await PB.restore()) return true;
    if (PB.isUnlocked()) return true;
    return await showGate();
  }

  async function afterUnlockSync() {
    if (PB.cloudEnabled && PB.cloudEnabled()) {
      const r = await PB.cloudPull();
      if (r.ok && r.pulled) toast('已从云端同步');
      else if (!r.ok) toast('云端同步失败：' + (r.reason || ''));
    }
  }

  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmtDate(s) { if (!s) return ''; const d = new Date(s); return `${d.getMonth() + 1}月${d.getDate()}日`; }
  function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function emptyHint(text) { return `<div class="empty">${brandMark()}<p>${esc(text)}</p></div>`; }

  function openModal(html) {
    const m = document.getElementById('modal-mask');
    m.innerHTML = `<div class="modal">${html}</div>`;
    m.classList.add('show');
    m.onclick = e => { if (e.target === m) closeModal(); };
  }
  function closeModal() {
    const m = document.getElementById('modal-mask');
    m.classList.remove('show'); m.innerHTML = '';
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  return { getNav, renderChrome, applyTheme, toggleTheme, toast, ensureUnlocked, afterUnlockSync, esc, fmtDate, todayStr, emptyHint, secureContextOK, openModal, closeModal };
})();
