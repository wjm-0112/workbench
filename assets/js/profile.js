/* ===== 我的（卡片式个人中心：信息 / 统计 / 快捷入口 / 今日习惯） ===== */
(async function () {
  const esc = PBUI.esc;
  const save = () => PB.save();
  const cfg = () => PB.getConfig();

  if (!await PBUI.ensureUnlocked()) return;
  PBUI.applyTheme(cfg().theme);
  PBUI.renderChrome('profile');
  await PBUI.afterUnlockSync();

  const data = () => PB.getData();
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function curStreak(checks) { const set = new Set(checks); let n = 0; const d = new Date(); const key = () => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; while (set.has(key())) { n++; d.setDate(d.getDate() - 1); } return n; }

  function computeStats() {
    const tasks = data().tasks; const t = todayStr();
    const pend = tasks.filter(x => x.status !== 'done').length;
    const over = tasks.filter(x => x.status !== 'done' && x.due && x.due < t).length;
    let streak = 0; (data().habits || []).forEach(h => { const s = curStreak(h.checks || []); if (s > streak) streak = s; });
    const m = data().finance || [];
    const mk = t.slice(0, 7);
    const income = m.filter(r => r.type === 'income' && (r.date || '').slice(0, 7) === mk).reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = m.filter(r => r.type === 'expense' && (r.date || '').slice(0, 7) === mk).reduce((s, r) => s + Number(r.amount || 0), 0);
    return { pending: pend, overdue: over, habitStreak: streak, monthFlow: income - expense };
  }

  function render() {
    const c = cfg(); const sc = computeStats(); const cloudOn = !!(c.cloud && c.cloud.enabled);
    const habits = data().habits || []; const t = todayStr();
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>我的</h1></div>

      <div class="profile-card">
        <div class="avatar" id="avatar">${esc((c.profile.userName || '我').slice(0, 1))}</div>
        <div class="meta">
          <input class="p-name" id="userName" value="${esc(c.profile.userName || '我')}">
          <input class="p-role" id="userRole" value="${esc(c.profile.role || '会员')}">
        </div>
      </div>

      <div class="grid-4">
        <div class="stat"><div class="label">待办</div><div class="num">${sc.pending}</div></div>
        <div class="stat"><div class="label">逾期</div><div class="num">${sc.overdue}</div></div>
        <div class="stat"><div class="label">习惯连续</div><div class="num">${sc.habitStreak}<span class="unit">天</span></div></div>
        <div class="stat"><div class="label">本月结余</div><div class="num ${sc.monthFlow >= 0 ? 'flow-in' : 'flow-out'}">${'¥' + (sc.monthFlow || 0).toLocaleString('zh-CN')}</div></div>
      </div>

      <div class="card">
        <h3>快捷入口</h3>
        <div class="quick-grid">
          <a class="quick-card" href="snippets.html"><span class="qc-ico">📚</span><span class="qc-label">知识库</span></a>
          <a class="quick-card" href="finance.html"><span class="qc-ico">💰</span><span class="qc-label">财政</span></a>
          <a class="quick-card" href="admin/index.html"><span class="qc-ico">🖥️</span><span class="qc-label">管理台</span></a>
          <a class="quick-card" href="settings.html"><span class="qc-ico">⚙️</span><span class="qc-label">设置</span></a>
        </div>
        <p class="muted-note">云同步状态：${cloudOn ? '已开启 ✅' : '未开启'}</p>
      </div>

      <div class="card">
        <div class="card-head"><h3 style="margin:0;">今日习惯</h3><button class="btn btn-sm" id="add-habit">+ 新建</button></div>
        <div id="habits">
          ${habits.length ? habits.map(h => {
            const on = (h.checks || []).includes(t);
            return `<div class="habit-row"><span>${esc(h.name)}</span><span class="muted-note">连续 ${curStreak(h.checks || [])} 天</span>
              <button class="chip ${on ? 'in' : ''} habit-toggle" data-hid="${h.id}">${on ? '已打卡' : '打卡'}</button>
              <button class="rowbtn danger habit-del" data-hid="${h.id}">删</button></div>`;
          }).join('') : '<p class="muted-note">还没有习惯，点「+ 新建」添加</p>'}
        </div>
      </div>
    `;
    bind();
  }

  function bind() {
    const c = cfg();
    const un = document.getElementById('userName'), ur = document.getElementById('userRole');
    un.oninput = () => { c.profile.userName = un.value; document.getElementById('avatar').textContent = (un.value || '我').slice(0, 1); save(); };
    ur.oninput = () => { c.profile.role = ur.value; save(); };
    const ah = document.getElementById('add-habit'); if (ah) ah.onclick = () => {
      const name = prompt('习惯名称：'); if (!name || !name.trim()) return;
      data().habits.push(PB.touch({ id: PB.uid(), name: name.trim(), checks: [] })); save(); render();
    };
    document.querySelectorAll('.habit-toggle').forEach(b => b.onclick = () => {
      const h = (data().habits || []).find(x => x.id === b.dataset.hid); if (!h) return; h.checks = h.checks || [];
      const t = todayStr(); const i = h.checks.indexOf(t); if (i >= 0) h.checks.splice(i, 1); else h.checks.push(t); PB.touch(h); save(); render();
    });
    document.querySelectorAll('.habit-del').forEach(b => b.onclick = () => {
      if (!confirm('删除该习惯？')) return; data().habits = data().habits.filter(x => x.id !== b.dataset.hid); save(); render();
    });
  }

  render();
})();
