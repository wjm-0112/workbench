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

  // 习惯可视化状态
  let hy = new Date().getFullYear(), hm = new Date().getMonth();
  let habitTab = '月历', selHabit = '';

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
          <a class="quick-card" href="snippets.html"><span class="qc-ico">${PBUI.icon('book')}</span><span class="qc-label">知识库</span></a>
          <a class="quick-card" href="finance.html"><span class="qc-ico">${PBUI.icon('wallet')}</span><span class="qc-label">财政</span></a>
          <a class="quick-card" href="admin/index.html"><span class="qc-ico">${PBUI.icon('shield')}</span><span class="qc-label">管理台</span></a>
          <a class="quick-card" href="settings.html"><span class="qc-ico">${PBUI.icon('config')}</span><span class="qc-label">设置</span></a>
        </div>
        <p class="muted-note">云同步状态：${cloudOn ? '已开启 ✅' : '未开启'}</p>
      </div>

      <div class="card" id="habit-card">
        <div class="card-head"><h3 style="margin:0;">习惯打卡</h3><button class="btn btn-sm" id="add-habit">+ 新建</button></div>
        <div class="habit-picker" id="habit-picker"></div>
        <div id="habit-subtabs"></div>
        <div id="habit-view"></div>
      </div>
    `;
    bind();
    renderHabits();
  }

  function renderHabits() {
    const habits = data().habits || [];
    const picker = document.getElementById('habit-picker');
    if (!habits.length) {
      picker.innerHTML = '<p class="muted-note">还没有习惯，点「+ 新建」添加</p>';
      document.getElementById('habit-subtabs').innerHTML = '';
      document.getElementById('habit-view').innerHTML = '';
      return;
    }
    if (!selHabit || !habits.find(h => h.id === selHabit)) selHabit = habits[0].id;
    picker.innerHTML = habits.map(h => `<span class="habit-chip ${h.id === selHabit ? 'active' : ''}" data-hid="${h.id}">
      <span class="hc-name">${esc(h.name)}</span><span class="hc-streak">连续 ${curStreak(h.checks || [])}天</span>
      <button class="hc-del" data-hid="${h.id}" title="删除">×</button></span>`).join('');
    picker.querySelectorAll('.habit-chip').forEach(ch => ch.onclick = (e) => {
      if (e.target.classList.contains('hc-del')) return;
      selHabit = ch.dataset.hid; renderHabits();
    });
    picker.querySelectorAll('.hc-del').forEach(b => b.onclick = () => {
      if (!confirm('删除该习惯？')) return;
      data().habits = data().habits.filter(x => x.id !== b.dataset.hid); save(); render();
    });

    const subWrap = document.getElementById('habit-subtabs');
    subWrap.innerHTML = '';
    subWrap.appendChild(PBUI.subtabs(['月历', '年热力'], habitTab, (v) => { habitTab = v; renderHabitView(); }));
    renderHabitView();
  }

  function renderHabitView() {
    const view = document.getElementById('habit-view'); if (!view) return;
    const h = (data().habits || []).find(x => x.id === selHabit); if (!h) return;
    const checks = new Set(h.checks || []);
    if (habitTab === '月历') {
      const cells = {};
      checks.forEach(d => { cells[d] = { habit: true }; });
      view.innerHTML = `
        <div class="cal-nav"><button id="cal-prev">‹</button><span>${hy}年${hm + 1}月</span><button id="cal-next">›</button></div>
        ${PBUI.monthCalendar({ year: hy, month: hm, cells })}
        <div class="cal-legend"><span><i class="cal-dot" style="background:var(--primary)"></i>已打卡</span><span><i class="cal-dot" style="background:var(--bg)"></i>未打卡</span><span class="muted-note">点日期切换打卡</span></div>`;
      view.querySelectorAll('.cal-cell[data-date]').forEach(c => c.onclick = () => toggleDay(c.dataset.date));
      document.getElementById('cal-prev').onclick = () => { hm--; if (hm < 0) { hm = 11; hy--; } renderHabitView(); };
      document.getElementById('cal-next').onclick = () => { hm++; if (hm > 11) { hm = 0; hy++; } renderHabitView(); };
    } else {
      const map = {}; let max = 1;
      checks.forEach(d => { map[d] = (map[d] || 0) + 1; max = Math.max(max, map[d]); });
      view.innerHTML = `<div class="muted-note" style="margin-bottom:8px;">${esc(h.name)} · 全年坚持密度（颜色越深当天打卡越多）</div>${PBUI.yearHeatmap({ year: hy, map, max })}`;
    }
  }

  function toggleDay(dateStr) {
    const h = (data().habits || []).find(x => x.id === selHabit); if (!h) return;
    h.checks = h.checks || []; const i = h.checks.indexOf(dateStr);
    if (i >= 0) h.checks.splice(i, 1); else h.checks.push(dateStr);
    PB.touch(h); save(); renderHabits();
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
  }

  render();
})();
