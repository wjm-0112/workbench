/* B 端后台 · 数据看板（先行） */
(function () {
  Admin.register('dashboard', {
    title: '数据看板',
    icon: '📊',
    async render(el) {
      const s = await Admin.api('/admin/stats');
      el.innerHTML = `
        <div class="grid stat-grid">
          ${stat('用户总数', s.totalUsers, '人')}
          ${stat('内容总数', s.totalContents, '篇')}
          ${stat('订单总数', s.totalOrders, '单')}
          ${stat('今日新增用户', s.newUsersToday, '人', 'var(--ok)')}
          ${stat('今日成交额', '¥' + s.revenueToday, '', 'var(--brand)')}
        </div>
        <div class="grid split" style="margin-top:16px">
          <div class="card">
            <div class="panel-head"><h2>近 7 日新增用户</h2></div>
            <div class="chart-box"><canvas id="trendChart"></canvas></div>
          </div>
          <div class="card">
            <div class="panel-head"><h2>内容状态分布</h2></div>
            <div class="chart-box"><canvas id="statusChart"></canvas></div>
          </div>
        </div>`;
      drawTrend(s.trend);
      drawStatus(s.contentByStatus);
    },
  });

  function stat(label, value, unit, color) {
    return `<div class="card stat">
      <div class="label">${Admin.esc(label)}</div>
      <div class="value" style="${color ? 'color:' + color : ''}">${Admin.esc(value)}<small>${Admin.esc(unit)}</small></div>
      <div class="sub">实时统计</div>
      <div class="bar"><i style="width:${Math.min(100, (value || 0) * 4)}%"></i></div>
    </div>`;
  }

  function drawTrend(trend) {
    if (typeof Chart === 'undefined') return;
    new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: trend.map((t) => t.date.slice(5)),
        datasets: [{ label: '新增用户', data: trend.map((t) => t.users), borderColor: '#2b4c7e', backgroundColor: 'rgba(43,76,126,.12)', fill: true, tension: .35 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
  }
  function drawStatus(map) {
    if (typeof Chart === 'undefined') return;
    const entries = Object.entries(map || {});
    new Chart(document.getElementById('statusChart'), {
      type: 'doughnut',
      data: { labels: entries.map((e) => e[0]), datasets: [{ data: entries.map((e) => e[1]), backgroundColor: ['#2b4c7e', '#1f9d6b', '#d98a00', '#95a3bd'] }] },
      options: { plugins: { legend: { position: 'bottom' } } },
    });
  }
})();
