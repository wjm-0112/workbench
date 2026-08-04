/* ===== 个人工作台 · 公共 UI（密码门/导航/蜡笔涂鸦/Toast） ===== */
const PBUI = (function () {
  /* 蜡笔风涂鸦装饰（小星星，非角色形象，仅点缀整体卡通风格） */
  function deco() {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M50 14 L62 41 L92 43 L69 62 L77 90 L50 73 L23 90 L31 62 L8 43 L38 41 Z" fill="#FFD93D" stroke="#3A3A3A" stroke-width="3.4" stroke-linejoin="round"/>
    </svg>`;
  }

  const ICON = {
    dashboard: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
    tasks: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h12M4 12h12M4 18h8"/><path d="M19 5l-2 2 2 2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    notes: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h11l4 4v14H5z"/><path d="M9 9h7M9 13h7M9 17h4"/></svg>',
    snippets: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>',
    settings: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>'
  };
  const NAV = [
    { key: 'dashboard', label: '看板', href: 'index.html', icon: ICON.dashboard },
    { key: 'tasks', label: '任务', href: 'tasks.html', icon: ICON.tasks },
    { key: 'notes', label: '笔记', href: 'notes.html', icon: ICON.notes },
    { key: 'snippets', label: '速查', href: 'snippets.html', icon: ICON.snippets },
    { key: 'settings', label: '设置', href: 'settings.html', icon: ICON.settings }
  ];

  function renderChrome(current) {
    const sb = document.getElementById('sidebar');
    if (sb) sb.innerHTML = `<div class="brand">${deco()}<span>个人工作台</span></div>` +
      NAV.map(n => `<a class="nav-item ${n.key === current ? 'active' : ''}" href="${n.href}"><span class="ico">${n.icon}</span>${n.label}</a>`).join('');
    const tb = document.getElementById('topbar');
    if (tb) tb.innerHTML = `${deco()}<span>个人工作台</span>`;
    const bar = document.getElementById('tabbar');
    if (bar) bar.innerHTML = NAV.map(n => `<a class="tab-item ${n.key === current ? 'active' : ''}" href="${n.href}"><span class="ico">${n.icon}</span>${n.label}</a>`).join('');
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
        ${deco()}
        <h1>个人工作台</h1>
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
    if (PB.isUnlocked()) return true;
    return await showGate();
  }

  async function afterUnlockSync() {
    const s = PB.getSettings();
    if (s.enabled) {
      const r = await PB.syncPull();
      if (r.ok && r.pulled) toast('已从云端同步');
      else if (!r.ok) toast('云端同步失败：' + (r.reason || ''));
    }
  }

  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmtDate(s) { if (!s) return ''; const d = new Date(s); return `${d.getMonth() + 1}月${d.getDate()}日`; }
  function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function emptyHint(text) { return `<div class="empty">${deco()}<p>${text}</p></div>`; }

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

  return { NAV, deco, renderChrome, toast, ensureUnlocked, afterUnlockSync, esc, fmtDate, todayStr, emptyHint, secureContextOK, openModal, closeModal };
})();
