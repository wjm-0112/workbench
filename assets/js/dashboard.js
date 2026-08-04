/* ===== 看板（概览 Hero + 整合日历 + 多元图表，子 tab 组织） ===== */
(async function () {
  const esc = PBUI.esc;
  const save = () => PB.save();
  let charts = [];
  let dashTab = '日历';
  let hy = new Date().getFullYear(), hm = new Date().getMonth();
  let notified = false;

  if (!await PBUI.ensureUnlocked()) return;
  PBUI.applyTheme(PB.getConfig().theme);
  PBUI.renderChrome('dashboard');
  await PBUI.afterUnlockSync();

  const data = () => PB.getData();
  const cfg = () => PB.getConfig();
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#1E3A8A';
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  function curStreak(checks) {
    const set = new Set(checks);
    let n = 0; const d = new Date();
    while (set.has(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function computeStats() {
    const tasks = data().tasks; const t = todayStr();
    const pend = tasks.filter(x => x.status !== 'done').length;
    const due = tasks.filter(x => x.status !== 'done' && x.due === t).length;
    const over = tasks.filter(x => x.status !== 'done' && x.due && x.due < t).length;
    let streak = 0;
    (data().habits || []).forEach(h => { const s = curStreak(h.checks || []); if (s > streak) streak = s; });
    const m = data().finance || []; const mk = t.slice(0, 7);
    const income = m.filter(r => r.type === 'income' && (r.date || '').slice(0, 7) === mk).reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = m.filter(r => r.type === 'expense' && (r.date || '').slice(0, 7) === mk).reduce((s, r) => s + Number(r.amount || 0), 0);
    return { pending: pend, dueToday: due, overdue: over, habitStreak: streak, monthFlow: income - expense };
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

  function last6Finance() {
    const labels = [], income = [], expense = [];
    const m = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(m.getFullYear(), m.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      labels.push(`${d.getMonth() + 1}月`);
      const recs = (data().finance || []).filter(r => (r.date || '').slice(0, 7) === key);
      income.push(recs.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0));
      expense.push(recs.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0));
    }
    return { labels, income, expense };
  }

  function destroyCharts() { charts.forEach(c => { try { c.destroy(); } catch (e) {} }); charts = []; }

  function pill(icon, label, num, acVar) {
    const ac = acVar ? `style="--ac:${acVar}"` : '';
    return `<div class="stat-pill" ${ac}><div class="sp-ico">${PBUI.icon(icon)}</div><div class="sp-body"><div class="sp-num">${num}</div><div class="sp-label">${label}</div></div></div>`;
  }

  function render() {
    const c = cfg(); const sc = computeStats();
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>${esc(c.siteName || '我的工作台')} · 概览</h1><span class="muted-note">${esc(new Date().toLocaleDateString('zh-CN'))}</span></div>
      <div class="hero ac-dashboard">
        <div class="hero-ico">${PBUI.icon('grid')}</div>
        <div class="hero-label">待办任务</div>
        <div class="hero-num">${sc.pending}</div>
        <div class="hero-sub">今日到期 ${sc.dueToday} · 逾期 ${sc.overdue}</div>
      </div>
      <div class="stat-pills">
        ${pill('flag', '今日到期', sc.dueToday, 'var(--warn)')}
        ${pill('habit', '习惯连续', sc.habitStreak + '天', 'var(--success)')}
        ${pill('coins', '本月结余', '¥' + (sc.monthFlow || 0).toLocaleString('zh-CN'), sc.monthFlow >= 0 ? 'var(--success)' : 'var(--accent)')}
      </div>
      <div id="dash-subtabs"></div>
      <div id="dash-tab"></div>
    `;
    document.getElementById('dash-subtabs').appendChild(PBUI.subtabs(['日历', '图表', '列表'], dashTab, v => { dashTab = v; renderTab(); }));
    renderTab();
    if (!notified && (sc.overdue || sc.dueToday)) { PBUI.toast(`你有 ${sc.overdue} 项已逾期、${sc.dueToday} 项今日到期`); notified = true; }
  }

  function renderTab() {
    destroyCharts();
    const tab = document.getElementById('dash-tab'); if (!tab) return;
    if (dashTab === '日历') tab.innerHTML = calendarBlock();
    else if (dashTab === '图表') tab.innerHTML = chartsBlock();
    else tab.innerHTML = listBlock();
    bindTab();
  }

  function calendarCells() {
    const y = hy, m = hm; const cells = {};
    const inMonth = ds => ds.slice(0, 7) === `${y}-${String(m + 1).padStart(2, '0')}`;
    (data().habits || []).forEach(h => (h.checks || []).forEach(d => { if (inMonth(d)) { cells[d] = cells[d] || { habit: false, task: 0, note: 0 }; cells[d].habit = true; } }));
    (data().tasks || []).forEach(t => { if (t.due && inMonth(t.due)) { cells[t.due] = cells[t.due] || { habit: false, task: 0, note: 0 }; cells[t.due].task++; } });
    (data().notes || []).forEach(n => { const d = (n.updatedAt || '').slice(0, 10); if (inMonth(d)) { cells[d] = cells[d] || { habit: false, task: 0, note: 0 }; cells[d].note++; } });
    return cells;
  }

  function calendarBlock() {
    const cells = calendarCells();
    return `
      <div class="card">
        <div class="cal-nav"><button id="cal-prev">‹</button><span>${hy}年${hm + 1}月</span><button id="cal-next">›</button></div>
        ${PBUI.monthCalendar({ year: hy, month: hm, cells })}
        <div class="cal-legend">
          <span><i class="cal-dot" style="background:var(--primary)"></i>习惯打卡</span>
          <span><i class="cal-dot task"></i>任务截止</span>
          <span><i class="cal-dot note"></i>笔记更新</span>
          <span class="muted-note">点日期查看当天事项</span>
        </div>
      </div>`;
  }

  function chartsBlock() {
    const offline = typeof Chart === 'undefined';
    const ph = '<p class="muted-note">图表库需联网加载（Chart.js CDN），当前离线未显示</p>';
    return `
      <div class="card"><div class="card-head"><h3 style="margin:0;">近 7 日完成任务</h3></div>
        <div class="chart-box">${offline ? ph : '<canvas id="trend"></canvas>'}</div></div>
      <div class="card"><div class="card-head"><h3 style="margin:0;">任务状态分布</h3></div>
        <div class="chart-box">${offline ? ph : '<canvas id="cat"></canvas>'}</div></div>
      <div class="card"><div class="card-head"><h3 style="margin:0;">近 6 月收支（绿=收入 / 红=支出）</h3></div>
        <div class="chart-box tall">${offline ? ph : '<canvas id="fin6"></canvas>'}</div></div>`;
  }

  function buildCharts() {
    if (typeof Chart === 'undefined') return;
    const t = last7();
    charts.push(new Chart(document.getElementById('trend'), {
      type: 'line', data: { labels: t.labels, datasets: [{ label: '完成数', data: t.counts, borderColor: cssVar('--primary'), backgroundColor: cssVar('--primary') + '22', fill: true, tension: .3 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: cssVar('--muted') } }, y: { ticks: { color: cssVar('--muted') }, beginAtZero: true } } } }
    ));
    const tasks = data().tasks;
    const ds = { todo: tasks.filter(x => x.status === 'todo').length, doing: tasks.filter(x => x.status === 'doing').length, done: tasks.filter(x => x.status === 'done').length };
    charts.push(new Chart(document.getElementById('cat'), {
      type: 'doughnut', data: { labels: ['待办', '进行中', '已完成'], datasets: [{ data: [ds.todo, ds.doing, ds.done], backgroundColor: [cssVar('--primary'), cssVar('--warn'), cssVar('--success')] }] },
      options: { plugins: { legend: { position: 'bottom', labels: { color: cssVar('--ink') } } } } }
    ));
    const f6 = last6Finance();
    charts.push(new Chart(document.getElementById('fin6'), {
      type: 'bar', data: { labels: f6.labels, datasets: [{ label: '收入', data: f6.income, backgroundColor: cssVar('--success') }, { label: '支出', data: f6.expense, backgroundColor: cssVar('--accent') }] },
      options: { plugins: { legend: { labels: { color: cssVar('--ink') } } }, scales: { x: { ticks: { color: cssVar('--muted') } }, y: { ticks: { color: cssVar('--muted') }, beginAtZero: true } } } }
    ));
  }

  function listBlock() {
    const tasks = (data().tasks || []).slice().sort((a, b) => (b.due || '').localeCompare(a.due || '')).slice(0, 6);
    const notes = (data().notes || []).slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5);
    const habits = data().habits || [];
    return `
      <div class="card"><div class="card-head"><h3 style="margin:0;">最近任务</h3><a class="btn btn-sm" href="planner.html">全部</a></div>
        ${tasks.length ? `<div class="recent-list">${tasks.map(t => `<a class="recent-item" href="planner.html"><span class="recent-title">${esc(t.title || '无标题')}</span><span class="muted-note">${esc(t.due ? PBUI.fmtDate(t.due) : '无截止')}</span></a>`).join('')}</div>` : '<p class="muted-note">暂无任务</p>'}</div>
      <div class="card"><div class="card-head"><h3 style="margin:0;">最近笔记</h3><a class="btn btn-sm" href="planner.html">全部</a></div>
        ${notes.length ? `<div class="recent-list">${notes.map(n => `<a class="recent-item" href="planner.html"><span class="recent-title">${esc(n.title || '无标题')}</span><span class="muted-note">${esc(PBUI.fmtDate(n.updatedAt))}</span></a>`).join('')}</div>` : '<p class="muted-note">暂无笔记</p>'}</div>
      <div class="card"><div class="card-head"><h3 style="margin:0;">习惯连续</h3><button class="btn btn-sm" id="add-habit">+ 新建</button></div>
        ${habits.length ? `<div class="recent-list">${habits.map(h => `<div class="recent-item"><span class="recent-title">${esc(h.name)}</span><span class="muted-note">连续 ${curStreak(h.checks || [])}天 <button class="rowbtn danger habit-del" data-hid="${h.id}">删</button></span></div>`).join('')}</div>` : '<p class="muted-note">暂无习惯</p>'}</div>`;
  }

  function eventsForDay(ds) {
    const tasks = (data().tasks || []).filter(t => t.due === ds);
    const notes = (data().notes || []).filter(n => (n.updatedAt || '').slice(0, 10) === ds);
    const habits = (data().habits || []).filter(h => (h.checks || []).includes(ds));
    const blk = (label, arr, name) => `<div class="field"><b>${label}（${arr.length}）</b>${arr.length ? arr.map(x => `<div>· ${esc(name(x))}</div>`).join('') : '<div class="muted-note">无</div>'}</div>`;
    PBUI.openModal(`<h2>${ds} 的事项</h2>
      ${blk('任务截止', tasks, t => t.title || '无标题')}
      ${blk('笔记更新', notes, n => n.title || '无标题')}
      ${blk('习惯打卡', habits, h => h.name)}
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">关闭</button></div>`);
  }

  function bindTab() {
    const prev = document.getElementById('cal-prev'), next = document.getElementById('cal-next');
    if (prev) prev.onclick = () => { hm--; if (hm < 0) { hm = 11; hy--; } renderTab(); };
    if (next) next.onclick = () => { hm++; if (hm > 11) { hm = 0; hy++; } renderTab(); };
    document.querySelectorAll('#dash-tab .cal-cell[data-date]').forEach(c => c.onclick = () => eventsForDay(c.dataset.date));
    if (dashTab === '图表') buildCharts();
    const ah = document.getElementById('add-habit');
    if (ah) ah.onclick = () => { const name = prompt('习惯名称：'); if (!name || !name.trim()) return; (data().habits = data().habits || []).push(PB.touch({ id: PB.uid(), name: name.trim(), checks: [] })); save(); renderTab(); };
    document.querySelectorAll('.habit-del').forEach(b => b.onclick = () => { if (!confirm('删除该习惯？')) return; data().habits = (data().habits || []).filter(x => x.id !== b.dataset.hid); save(); renderTab(); });
  }

  render();
})();
