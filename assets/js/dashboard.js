/* ===== 看板（配置驱动：统计卡 + 趋势 + 占比 + 习惯） ===== */
(async function () {
  const esc = PBUI.esc;
  const save = () => PB.save();
  let charts = [];

  if (!await PBUI.ensureUnlocked()) return;
  PBUI.applyTheme(PB.getConfig().theme);
  PBUI.renderChrome('dashboard');
  await PBUI.afterUnlockSync();

  const data = () => PB.getData();
  const cfg = () => PB.getConfig();
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#1E3A8A';
  let notified = false;
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function dayDiff(a, b) { return Math.round((new Date(a) - new Date(b)) / 86400000); }

  function computeStats() {
    const tasks = data().tasks;
    const t = todayStr();
    const pend = tasks.filter(x => x.status !== 'done').length;
    const due = tasks.filter(x => x.status !== 'done' && x.due === t).length;
    const over = tasks.filter(x => x.status !== 'done' && x.due && x.due < t).length;
    let streak = 0;
    (data().habits || []).forEach(h => { const s = curStreak(h.checks || []); if (s > streak) streak = s; });
    const m = data().finance || [];
    const mk = t.slice(0, 7);
    const income = m.filter(r => r.type === 'income' && (r.date || '').slice(0, 7) === mk).reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = m.filter(r => r.type === 'expense' && (r.date || '').slice(0, 7) === mk).reduce((s, r) => s + Number(r.amount || 0), 0);
    return { pending: pend, dueToday: due, overdue: over, habitStreak: streak, monthFlow: income - expense };
  }

  function curStreak(checks) {
    const set = new Set(checks);
    let n = 0; const d = new Date();
    while (set.has(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function last7() {
    const labels = [], counts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      counts.push(data().tasks.filter(x => x.status === 'done' && (x.updatedAt || '').slice(0, 10) === ds).length);
    }
    return { labels, counts };
  }

  function destroyCharts() { charts.forEach(c => { try { c.destroy(); } catch (e) {} }); charts = []; }

  function render() {
    destroyCharts();
    const c = cfg();
    const sc = computeStats();
    const cards = [
      { k: 'pending', label: '待办任务', html: `${sc.pending}` },
      { k: 'dueToday', label: '今日到期', html: `${sc.dueToday}` },
      { k: 'overdue', label: '已逾期', html: `${sc.overdue}` },
      { k: 'habitStreak', label: '习惯连续(天)', html: `${sc.habitStreak}` },
      { k: 'monthFlow', label: '本月结余', html: `<span class="${sc.monthFlow >= 0 ? 'flow-in' : 'flow-out'}">¥${(sc.monthFlow || 0).toLocaleString('zh-CN')}</span>` }
    ];
    const show = c.dashboard.showCards || [];
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>${esc(c.siteName || '我的工作台')} · 概览</h1><span class="muted-note">${esc(new Date().toLocaleDateString('zh-CN'))}</span></div>
      <div class="grid-4">
        ${cards.filter(cd => show.includes(cd.k)).map(cd => `
          <div class="stat"><div class="label">${cd.label}</div><div class="num">${cd.html}</div></div>`).join('')}
      </div>
      ${(c.dashboard.showWeekTrend !== false) ? `
      <div class="card"><h3>近 7 日完成任务趋势</h3><div style="max-width:640px;"><canvas id="trend" height="120"></canvas></div>
        ${typeof Chart === 'undefined' ? '<p class="muted-note">（图表库需联网加载，当前离线未显示）</p>' : ''}</div>` : ''}
      ${(c.dashboard.showCategoryBreakdown !== false) ? `
      <div class="card"><h3>任务状态分布</h3><div style="max-width:360px;"><canvas id="cat" height="200"></canvas></div>
        ${typeof Chart === 'undefined' ? '<p class="muted-note">（图表库需联网加载，当前离线未显示）</p>' : ''}</div>` : ''}
      <div class="card"><h3>最近笔记</h3><div id="recentNotes">${recentNotesHTML()}</div></div>
      <div class="card"><div class="card-head"><h3 style="margin:0;">习惯打卡</h3><button class="btn btn-sm" id="add-habit">+ 新建</button></div><div id="habits">${habitsHTML()}</div></div>
    `;
    if (typeof Chart !== 'undefined') {
      if (c.dashboard.showWeekTrend !== false) {
        const t = last7();
        charts.push(new Chart(document.getElementById('trend'), {
          type: 'line', data: { labels: t.labels, datasets: [{ label: '完成数', data: t.counts, borderColor: cssVar('--primary'), backgroundColor: cssVar('--primary') + '22', fill: true, tension: .3 }] },
          options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: cssVar('--muted') } }, y: { ticks: { color: cssVar('--muted') }, beginAtZero: true } } } }
        ));
      }
      if (c.dashboard.showCategoryBreakdown !== false) {
        const tasks = data().tasks;
        const ds = { todo: tasks.filter(x => x.status === 'todo').length, doing: tasks.filter(x => x.status === 'doing').length, done: tasks.filter(x => x.status === 'done').length };
        charts.push(new Chart(document.getElementById('cat'), {
          type: 'doughnut', data: { labels: ['待办', '进行中', '已完成'], datasets: [{ data: [ds.todo, ds.doing, ds.done], backgroundColor: [cssVar('--primary'), cssVar('--warn'), cssVar('--success')] }] },
          options: { plugins: { legend: { position: 'bottom', labels: { color: cssVar('--ink') } } } } }
        ));
      }
    }
    bindHabits();
    if (!notified && (sc.overdue || sc.dueToday)) {
      PBUI.toast(`你有 ${sc.overdue} 项已逾期、${sc.dueToday} 项今日到期`, '');
      notified = true;
    }
  }

  function recentNotesHTML() {
    const notes = (data().notes || []).slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5);
    if (!notes.length) return '<p class="muted-note">还没有笔记</p>';
    return `<div class="recent-list">${notes.map(n => `
      <a class="recent-item" href="planner.html">
        <span class="recent-title">${esc(n.title || '无标题')}</span>
        <span class="muted-note">${esc(PBUI.fmtDate(n.updatedAt))}</span>
      </a>`).join('')}</div>`;
  }

  function habitsHTML() {
    const habits = data().habits || [];
    if (!habits.length) return PBUI.emptyHint('还没有习惯项，点上方「+ 新建」添加');
    const t = todayStr();
    return habits.map(h => {
      h.checks = h.checks || [];
      const cells = [];
      for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; cells.push(`<div class="habit-cell ${h.checks.includes(ds) ? 'on' : ''}" data-hid="${h.id}" data-d="${ds}">${d.getDate()}</div>`); }
      return `<div class="habit-row"><span>${esc(h.name)}</span><span class="muted-note">连续 ${curStreak(h.checks)} 天</span>
        <button class="rowbtn danger habit-del" data-hid="${h.id}">删</button></div><div class="habit-grid">${cells.join('')}</div>`;
    }).join('');
  }

  function bindHabits() {
    const ah = document.getElementById('add-habit'); if (ah) ah.onclick = () => {
      const name = prompt('习惯名称：'); if (!name || !name.trim()) return;
      (data().habits = data().habits || []).push(PB.touch({ id: PB.uid(), name: name.trim(), checks: [] }));
      save(); render();
    };
    document.querySelectorAll('.habit-cell').forEach(cell => cell.onclick = () => {
      const h = (data().habits || []).find(x => x.id === cell.dataset.hid); if (!h) return;
      h.checks = h.checks || []; const d = cell.dataset.d;
      const i = h.checks.indexOf(d); if (i >= 0) h.checks.splice(i, 1); else h.checks.push(d);
      PB.touch(h); save(); render();
    });
    document.querySelectorAll('.habit-del').forEach(b => b.onclick = () => {
      if (!confirm('删除该习惯？打卡记录将一并清除')) return;
      data().habits = (data().habits || []).filter(x => x.id !== b.dataset.hid);
      save(); render();
    });
  }

  render();
})();
