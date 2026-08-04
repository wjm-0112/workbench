/* 管理台 · 概览（本地数据统计，替代原后端 /admin/stats） */
(function () {
  Admin.register('dashboard', {
    title: '数据概览',
    icon: 'dashboard',
    render(el) {
      const d = Admin.data();
      const tasks = d.tasks || [];
      const notes = d.notes || [];
      const habits = d.habits || [];
      const savings = d.savings || [];
      const today = new Date().toISOString().slice(0, 10);
      const done = tasks.filter((t) => t.status === 'done').length;
      const overdue = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < today).length;
      const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

      el.innerHTML = `
        <div class="grid stat-grid">
          ${stat('任务总数', tasks.length, '项')}
          ${stat('已完成', done, '项', 'var(--ok)')}
          ${stat('完成率', rate, '%', 'var(--brand)')}
          ${stat('已逾期', overdue, '项', overdue ? 'var(--warn)' : 'var(--text)')}
          ${stat('笔记', notes.length, '篇')}
          ${stat('习惯项', habits.length, '个')}
          ${stat('攒钱笔数', savings.length, '笔')}
        </div>
        <div class="grid split" style="margin-top:16px">
          <div class="card">
            <div class="panel-head"><h2>近 7 日新增任务</h2></div>
            <div class="chart-box"><canvas id="trendChart"></canvas></div>
          </div>
          <div class="card">
            <div class="panel-head"><h2>模块数量分布</h2></div>
            <div class="chart-box"><canvas id="statusChart"></canvas></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="panel-head"><h2>近 6 月财政收支</h2><span class="muted">绿=收入 · 红=支出</span></div>
          <div class="chart-box"><canvas id="fin6Chart"></canvas></div>
        </div>`;
      drawTrend(last7(tasks));
      drawStatus({ 任务: tasks.length, 笔记: notes.length, 习惯: habits.length, 攒钱: savings.length });
      drawFin6(d.finance || []);
    },
  });

  function stat(label, value, unit, color) {
    return `<div class="card stat">
      <div class="label">${Admin.esc(label)}</div>
      <div class="value" style="${color ? 'color:' + color : ''}">${Admin.esc(value)}<small>${Admin.esc(unit)}</small></div>
      <div class="sub">本地统计</div>
      <div class="bar"><i style="width:${Math.min(100, (value || 0) * 4)}%"></i></div>
    </div>`;
  }

  function last7(tasks) {
    const days = [];
    const map = {};
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      days.push(dt); map[dt] = 0;
    }
    (tasks || []).forEach((t) => {
      const c = (t.createdAt || t.updatedAt || '').slice(0, 10);
      if (c in map) map[c]++;
    });
    return days.map((dt) => ({ date: dt, n: map[dt] }));
  }

  function drawTrend(trend) {
    if (typeof Chart === 'undefined') return;
    new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: trend.map((t) => t.date.slice(5)),
        datasets: [{ label: '新增任务', data: trend.map((t) => t.n), borderColor: '#2b4c7e', backgroundColor: 'rgba(43,76,126,.12)', fill: true, tension: .35 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
  }
  function drawStatus(map) {
    if (typeof Chart === 'undefined') return;
    const entries = Object.entries(map || {});
    new Chart(document.getElementById('statusChart'), {
      type: 'doughnut',
      data: { labels: entries.map((e) => e[0]), datasets: [{ data: entries.map((e) => e[1]), backgroundColor: ['#2b4c7e', '#1f9d6b', '#d98a00', '#a56bff'] }] },
      options: { plugins: { legend: { position: 'bottom' } } },
    });
  }
  function drawFin6(finance) {
    if (typeof Chart === 'undefined') return;
    const labels = [], income = [], expense = [];
    const m = new Date();
    for (let i = 5; i >= 0; i--) {
      const dd = new Date(m.getFullYear(), m.getMonth() - i, 1);
      const key = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`;
      labels.push(`${dd.getMonth() + 1}月`);
      const recs = finance.filter((r) => (r.date || '').slice(0, 7) === key);
      income.push(recs.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0));
      expense.push(recs.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0));
    }
    new Chart(document.getElementById('fin6Chart'), {
      type: 'bar',
      data: { labels, datasets: [{ label: '收入', data: income, backgroundColor: '#1f9d6b' }, { label: '支出', data: expense, backgroundColor: '#d9483b' }] },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
    });
  }
})();
