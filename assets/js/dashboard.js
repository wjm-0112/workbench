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
    return { pending: pend, dueToday: due, overdue: over, habitStreak: streak };
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
    const cardDefs = [
      ['pending', '待办任务', sc.pending],
      ['dueToday', '今日到期', sc.dueToday],
      ['overdue', '已逾期', sc.overdue],
      ['habitStreak', '习惯连续(天)', sc.habitStreak]
    ];
    const show = c.dashboard.showCards || [];
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>${esc(c.siteName || '我的工作台')} · 概览</h1><span class="muted-note">${esc(new Date().toLocaleDateString('zh-CN'))}</span></div>
      <div class="grid-4">
        ${cardDefs.filter(([k]) => show.includes(k)).map(([, label, num]) => `
          <div class="stat"><div class="label">${label}</div><div class="num">${num}</div></div>`).join('')}
      </div>
      ${(c.dashboard.showWeekTrend !== false) ? `
      <div class="card"><h3>近 7 日完成任务趋势</h3><div style="max-width:640px;"><canvas id="trend" height="120"></canvas></div>
        ${typeof Chart === 'undefined' ? '<p class="muted-note">（图表库需联网加载，当前离线未显示）</p>' : ''}</div>` : ''}
      ${(c.dashboard.showCategoryBreakdown !== false) ? `
      <div class="card"><h3>任务状态分布</h3><div style="max-width:360px;"><canvas id="cat" height="200"></canvas></div>
        ${typeof Chart === 'undefined' ? '<p class="muted-note">（图表库需联网加载，当前离线未显示）</p>' : ''}</div>` : ''}
      <div class="card"><h3>习惯打卡</h3><div id="habits">${habitsHTML()}</div></div>
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
  }

  function habitsHTML() {
    const habits = data().habits || [];
    if (!habits.length) return PBUI.emptyHint('还没有习惯项，去「我的 → 默认预设 → 习惯打卡项」添加');
    const t = todayStr();
    return habits.map(h => {
      h.checks = h.checks || [];
      const cells = [];
      for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; cells.push(`<div class="habit-cell ${h.checks.includes(ds) ? 'on' : ''}" data-hid="${h.id}" data-d="${ds}">${d.getDate()}</div>`); }
      return `<div class="habit-row"><span>${esc(h.name)}</span><span class="muted-note">连续 ${curStreak(h.checks)} 天</span></div><div class="habit-grid">${cells.join('')}</div>`;
    }).join('');
  }

  function bindHabits() {
    document.querySelectorAll('.habit-cell').forEach(cell => cell.onclick = () => {
      const h = (data().habits || []).find(x => x.id === cell.dataset.hid); if (!h) return;
      h.checks = h.checks || []; const d = cell.dataset.d;
      const i = h.checks.indexOf(d); if (i >= 0) h.checks.splice(i, 1); else h.checks.push(d);
      PB.touch(h); save(); render();
    });
  }

  render();
})();
