/* ===== 财政（手机端重构：子 tab 概览/趋势/明细 + 卡片化 + 底部弹窗） ===== */
(async function () {
  const esc = PBUI.esc;
  const save = () => PB.save();
  const TYPES = { income: '收入', expense: '支出' };

  if (!await PBUI.ensureUnlocked()) return;
  const cfg = () => PB.getConfig();
  const mods = cfg().modules.filter(m => m.enabled !== false);
  if (!mods.find(m => m.key === 'finance')) {
    const first = mods[0];
    location.href = first ? (first.key === 'dashboard' ? 'index.html' : (PAGE_HREF[first.key] || first.href || 'index.html')) : 'index.html';
    return;
  }
  PBUI.applyTheme(cfg().theme);
  PBUI.renderChrome('finance');
  await PBUI.afterUnlockSync();

  const data = () => PB.getData();
  if (!data().financeGoals) data().financeGoals = [];
  if (!data().savings) data().savings = [];
  let fType = '', fMonth = '', fAccount = '';
  let finTab = '概览';
  let trendGran = '月'; let trendYear = new Date().getFullYear(); let trendMonth = new Date().getMonth();
  let charts = [];
  const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const money = n => '¥' + (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const monthRecs = arr => arr.filter(r => (r.date || '').slice(0, 7) === (fMonth || curMonth()));
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#1E3A8A';
  const destroyCharts = () => { charts.forEach(c => { try { c.destroy(); } catch (e) {} }); charts = []; };

  // ---- 辅助：分类 icon、账户 icon、余额计算（v2.4 小荷包风格） ----
  const CAT_ICONS = { '餐饮':'🥘', '交通':'🚗', '购物':'🛒', '居住':'🏠', '娱乐':'🎬', '医疗':'💊', '收入':'💰', '理财':'💹', '其他':'📦' };
  function catIcon(cat) { return CAT_ICONS[cat] || '📌'; }
  function accIcon(type) { const m = { '支付宝':'💙', '微信':'💚', '银行卡':'🏦', '现金':'💵', '其他':'💳' }; return m[type] || '💳'; }
  function accounts() { return cfg().defaults.accounts || []; }
  function accountById(id) { return accounts().find(a => a.id === id); }
  function accountBalance(a, recs) {
    const income = recs.filter(r => r.accountId === a.id && r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = recs.filter(r => r.accountId === a.id && r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0);
    return (a.initialBalance || 0) + income - expense;
  }

  function render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>财政</h1><button class="btn btn-primary" id="add">+ 记账</button></div>
      <div id="fin-subtabs"></div>
      <div id="fin-tab"></div>`;
    document.getElementById('add').onclick = () => editRecord(null);
    document.getElementById('fin-subtabs').appendChild(PBUI.subtabs(['概览', '趋势', '明细', '攒钱'], finTab, v => { finTab = v; renderTab(); }));
    renderTab();
  }

  function renderTab() {
    destroyCharts();
    const tab = document.getElementById('fin-tab'); if (!tab) return;
    if (finTab === '概览') tab.innerHTML = overviewHTML();
    else if (finTab === '趋势') tab.innerHTML = trendHTML();
    else if (finTab === '明细') tab.innerHTML = detailHTML();
    else tab.innerHTML = savingsHTML();
    bindTab();
  }

  function overviewHTML() {
    const d = data();
    const month = fMonth || curMonth();
    const mRecs = monthRecs(d.finance || []);
    const income = mRecs.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = mRecs.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0);
    const balance = income - expense;
    const savedTotal = (d.savings || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const catKeys = Object.keys(mRecs.filter(r => r.type === 'expense').reduce((o, r) => { const k = r.category || '其他'; o[k] = (o[k] || 0) + Number(r.amount || 0); return o; }, {}))
      .sort((a, b) => mRecs.filter(r => r.type === 'expense' && r.category === b).reduce((s, r) => s + Number(r.amount || 0), 0) - mRecs.filter(r => r.type === 'expense' && r.category === a).reduce((s, r) => s + Number(r.amount || 0), 0));
    const goals = d.financeGoals || [];
    const accs = accounts();
    // 获取所有账户当月收支（含无 accountId 的旧记录 → 归入第一个账户）
    const accStats = accs.map(a => {
      const aIn = mRecs.filter(r => r.accountId === a.id && r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0);
      const aOut = mRecs.filter(r => r.accountId === a.id && r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0);
      return { ...a, income: aIn, expense: aOut, balance: (a.initialBalance || 0) + aIn - aOut };
    });

    return `
      <div class="fin-hero">
        <div class="fin-hero-label"><input type="month" id="fMonth" value="${esc(month)}" style="border:none;background:transparent;font-size:13px;color:var(--muted);padding:0;text-align:center;box-shadow:none;width:140px;"></div>
        <div class="fin-hero-balance ${balance >= 0 ? 'flow-in' : 'flow-out'}">${balance >= 0 ? '+' : ''}${money(balance)}</div>
        <div class="fin-hero-row"><span>收入 ${money(income)}</span><span class="fin-hero-sep">|</span><span>支出 ${money(expense)}</span></div>
        ${mRecs.length ? `<div class="fin-hero-bar"><i style="width:${expense > 0 ? Math.round(expense / Math.max(income + expense, 1) * 100) : 0}%"></i></div>` : '<p class="hint" style="margin-top:6px;">本月还没有记账</p>'}
        ${catKeys.length ? `<div class="fin-hero-cats">${catKeys.slice(0, 6).map(k => `<span class="fin-cat-chip">${catIcon(k)} ${esc(k)}</span>`).join('')}</div>` : ''}
      </div>

      ${accs.length ? `
      <div class="card"><div class="card-head"><h3 style="margin:0;">账户</h3><span class="muted-note">${accs.length} 个</span></div>
        <div class="acc-list">${accStats.map(a => `
          <div class="acard">
            <span class="acard-icon">${accIcon(a.type)}</span>
            <div class="acard-info">
              <span class="acard-name">${esc(a.name)}${a.bank ? `<span class="muted-note"> · ${esc(a.bank)}</span>` : ''}</span>
              <span class="acard-bal ${a.balance >= 0 ? 'flow-in' : 'flow-out'}">${money(a.balance)}</span>
            </div>
            <div class="acard-sub"><span>+${money(a.income)}</span><span style="margin-left:8px;">-${money(a.expense)}</span></div>
          </div>`).join('')}</div>
      </div>` : ''}

      ${savedTotal > 0 ? `<div class="card"><span class="chip in" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:6px;">🏦 攒钱合计</span><div class="num flow-in" style="margin:0;">${money(savedTotal)}</div></div>` : ''}

      <div class="card">
        <div class="card-head"><h3 style="margin:0;">目标</h3><button class="btn btn-sm btn-primary" id="add-goal">+ 新增</button></div>
        ${goals.length ? goals.map(g => {
          const pct = g.target > 0 ? Math.min(100, Math.round((Number(g.current || 0) / Number(g.target)) * 100)) : 0;
          return `<div class="goal">
            <div class="goal-top"><span>${esc(g.name)}${g.month ? ` <span class="muted-note">· ${esc(g.month)}</span>` : ''}</span><span class="muted-note">${money(g.current || 0)} / ${money(g.target)}</span></div>
            <div class="progress"><i style="width:${pct}%"></i></div>
            <div class="actions" style="margin-top:2px;"><button class="rowbtn" data-gedit="${g.id}">编辑</button><button class="rowbtn danger" data-gdel="${g.id}">删除</button></div>
          </div>`;
        }).join('') : '<p class="muted-note">还没有目标，点「新增」制定预算或理财计划</p>'}
      </div>

      <button class="fab" id="fab-add" title="记一笔">💰</button>`;
  }

  function trendHTML() {
    const labels = ['日', '月', '年'];
    return `
      <div class="seg" id="trend-seg">${labels.map(l => `<button class="seg-btn${l === trendGran ? ' active' : ''}" data-tg="${l}">${l}</button>`).join('')}</div>
      <div class="card"><div class="card-head"><h3 style="margin:0;" id="trend-title"></h3></div>
        <div class="chart-box tall">${typeof Chart === 'undefined' ? '<p class="muted-note">图表库需联网加载（Chart.js CDN）</p>' : '<canvas id="trend-cvs"></canvas>'}</div>
      </div>`;
  }

  function detailHTML() {
    let all = (data().finance || [])
      .filter(r => !fType || r.type === fType)
      .filter(r => !fMonth || (r.date || '').slice(0, 7) === fMonth)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    // 按账户筛选（v2.4 新增 accountId 支持）
    if (fAccount) all = all.filter(r => r.accountId === fAccount);
    const accs = accounts();
    const accOpts = accs.map(a => `<option value="${a.id}" ${fAccount === a.id ? 'selected' : ''}>${accIcon(a.type)} ${esc(a.name)}</option>`).join('');
    return `
      <div class="fin-filter">
        <label class="ff-item"><span class="ff-ico">${PBUI.icon('calendar')}</span><span class="ff-lab">月份</span><input type="month" id="fMonth" value="${esc(fMonth)}"></label>
        <label class="ff-item"><span class="ff-ico">${PBUI.icon('coins')}</span><span class="ff-lab">类型</span>
          <select id="fType"><option value="">全部</option><option value="income" ${fType === 'income' ? 'selected' : ''}>收入</option><option value="expense" ${fType === 'expense' ? 'selected' : ''}>支出</option></select></label>
        ${accs.length ? `<label class="ff-item"><span class="ff-ico">${PBUI.icon('wallet')}</span><span class="ff-lab">账户</span>
          <select id="fAccount"><option value="">全部</option>${accOpts}</select></label>` : ''}
      </div>
      <div class="card"><h3>收支明细</h3>
        <div class="rec-list">
          ${all.length ? all.map(r => {
            const a = accountById(r.accountId);
            return `
            <div class="rec-card" data-id="${r.id}">
              <div class="rec-top"><span class="rec-cat-icon">${catIcon(r.category || '其他')}</span><span>${esc(r.category || '—')}<span class="muted-note">${r.note ? ' · ' + esc(r.note) : ''}</span></span><span class="chip ${r.type === 'income' ? 'in' : 'out'}">${TYPES[r.type]}</span></div>
              <div class="rec-bottom"><span class="rec-date">${esc((r.date || '').slice(5) || '—')}${a ? ` · ${accIcon(a.type)}${esc(a.name)}` : ''}</span>
                <span class="rec-amt ${r.type === 'income' ? 'flow-in' : 'flow-out'}">${r.type === 'income' ? '+' : '-'}${money(r.amount)}</span>
                <span class="rec-actions"><button class="rowbtn" data-edit="${r.id}">编辑</button><button class="rowbtn danger" data-del="${r.id}">删除</button></span></div>
            </div>`;
          }).join('') : PBUI.emptyHint('还没有记账，点下面按钮开始')}
        </div>
      </div>`;
  }

  function savingsHTML() {
    const list = (data().savings || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `
      <div class="card">
        <div class="card-head"><h3 style="margin:0;">攒钱记录</h3><button class="btn btn-sm btn-primary" id="add-save">+ 记攒钱</button></div>
        <div class="rec-list">
          ${list.length ? list.map(r => `
            <div class="rec-card" data-id="${r.id}">
              <div class="rec-top"><span class="rec-date">${esc((r.date || '').slice(5) || '—')}</span><span class="chip in">攒钱</span></div>
              <div class="rec-mid"><span class="rec-cat">${esc(r.method || '—')}</span><span class="rec-account muted-note">${esc(r.intention || '')}</span></div>
              <div class="rec-bottom"><span class="rec-amt flow-in">+${money(r.amount)}</span>
                <span class="rec-actions"><button class="rowbtn" data-sedit="${r.id}">编辑</button><button class="rowbtn danger" data-sdel="${r.id}">删除</button></span></div>
              ${r.note ? `<div class="rec-note muted-note">${esc(r.note)}</div>` : ''}
            </div>`).join('') : PBUI.emptyHint('还没有攒钱记录，点「记攒钱」开始积累')}
        </div>
      </div>`;
  }

  function editSaving(id) {
    const r = id ? data().savings.find(x => x.id === id) : null;
    const methods = cfg().defaults.savingsMethods || [];
    const accs = accounts();
    PBUI.openModal(`
      <div class="sheet-grip"></div>
      <h2>${r ? '编辑攒钱' : '记一笔攒钱'}</h2>
      <div class="r-amount"><input type="number" id="s-amount" min="0" step="0.01" value="${esc(r ? r.amount : '')}" placeholder="0.00" inputmode="decimal"></div>
      <div class="form-grid">
        <label class="field"><span class="field-label">存储方式</span><input type="text" id="s-method" list="saveMethods" value="${esc(r ? r.method : '')}" placeholder="现金 / 银行卡…"><datalist id="saveMethods">${methods.map(m => `<option value="${esc(m)}">`).join('')}</datalist></label>
        <label class="field"><span class="field-label">来源账户</span>
          <select id="s-acc"><option value="">—</option>${accs.map(a => `<option value="${a.id}" ${r && r.accountId === a.id ? 'selected' : ''}>${accIcon(a.type)} ${esc(a.name)}</option>`).join('')}</select></label>
      </div>
      <div class="form-grid">
        <label class="field"><span class="field-label">存储意向</span><input type="text" id="s-intention" value="${esc(r ? r.intention : '')}" placeholder="如 旅游基金"></label>
        <label class="field"><span class="field-label">日期</span><input type="date" id="s-date" value="${esc(r ? r.date : new Date().toISOString().slice(0, 10))}"></label>
      </div>
      <div class="r-note-toggle" id="s-note-tgl">▸ 添加备注（可选）</div>
      <input type="text" id="s-note" value="${esc(r ? r.note : '')}" placeholder="备注" style="display:none;margin-top:4px;">
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">取消</button><button class="btn btn-primary" id="s-save">✓ 保存</button></div>`, 'modal-sheet');
    document.getElementById('s-note-tgl').onclick = () => {
      const n = document.getElementById('s-note'); const t = document.getElementById('s-note-tgl');
      if (n.style.display === 'none') { n.style.display = ''; t.textContent = '▾ 收起备注'; } else { n.style.display = 'none'; t.textContent = '▸ 添加备注（可选）'; }
    };
    document.getElementById('s-save').onclick = () => {
      const amount = parseFloat(document.getElementById('s-amount').value);
      if (isNaN(amount) || amount < 0) { PBUI.toast('请输入有效金额'); return; }
      const obj = {
        amount,
        method: document.getElementById('s-method').value.trim(),
        intention: document.getElementById('s-intention').value.trim(),
        accountId: document.getElementById('s-acc').value || undefined,
        date: document.getElementById('s-date').value,
        note: document.getElementById('s-note').value.trim()
      };
      if (r) { Object.assign(r, obj); PB.touch(r); } else { obj.id = PB.uid(); data().savings.push(PB.touch(obj)); }
      save(); PBUI.closeModal(); renderTab();
    };
  }

  function bindTab() {
    // 趋势图表（日/月/年）
    const tcv = document.getElementById('trend-cvs');
    if (tcv && typeof Chart !== 'undefined') {
      const recs = data().finance || [];
      let labels = [], income = [], expense = [];
      let title = '';
      if (trendGran === '日') {
        const days = new Date(trendYear, trendMonth + 1, 0).getDate();
        title = `${trendYear}年${trendMonth + 1}月 · 每日收支`;
        for (let d = 1; d <= days; d++) {
          const ds = `${trendYear}-${String(trendMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          labels.push(String(d));
          income.push(recs.filter(r => r.type === 'income' && r.date === ds).reduce((s, r) => s + Number(r.amount || 0), 0));
          expense.push(recs.filter(r => r.type === 'expense' && r.date === ds).reduce((s, r) => s + Number(r.amount || 0), 0));
        }
      } else if (trendGran === '月') {
        title = `${trendYear}年 · 月度收支`;
        for (let m = 0; m < 12; m++) {
          const key = `${trendYear}-${String(m + 1).padStart(2, '0')}`;
          labels.push(`${m + 1}月`);
          income.push(recs.filter(r => r.date && r.date.slice(0, 7) === key && r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0));
          expense.push(recs.filter(r => r.date && r.date.slice(0, 7) === key && r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0));
        }
      } else {
        const thisYear = new Date().getFullYear();
        const start = Math.max(thisYear - 4, 2020);
        title = `${start}-${thisYear} · 年度收支`;
        for (let y = start; y <= thisYear; y++) {
          labels.push(String(y));
          const yRecs = recs.filter(r => r.date && r.date.slice(0, 4) === String(y));
          income.push(yRecs.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0));
          expense.push(yRecs.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0));
        }
      }
      document.getElementById('trend-title').textContent = title;
      const chartType = trendGran === '日' ? 'line' : 'bar';
      charts.push(new Chart(tcv, { type: chartType, data: { labels, datasets: [
        { label: '收入', data: income, borderColor: cssVar('--success'), backgroundColor: trendGran === '日' ? cssVar('--success') + '33' : cssVar('--success'), borderWidth: 2, tension: 0.3, fill: trendGran === '日' },
        { label: '支出', data: expense, borderColor: cssVar('--accent'), backgroundColor: trendGran === '日' ? cssVar('--accent') + '33' : cssVar('--accent'), borderWidth: 2, tension: 0.3, fill: trendGran === '日' }
      ] }, options: { responsive: true, plugins: { legend: { labels: { color: cssVar('--ink'), usePointStyle: true } } }, scales: { x: { ticks: { color: cssVar('--muted') } }, y: { ticks: { color: cssVar('--muted') }, beginAtZero: true } } } }));
    }
    // 趋势分段按钮
    const seg = document.getElementById('trend-seg');
    if (seg) seg.querySelectorAll('.seg-btn').forEach(b => b.onclick = () => {
      trendGran = b.dataset.tg; renderTab();
    });
    // 日视图可切换月份
    if (trendGran === '日') {
      let prevBtn = document.getElementById('trend-prev'), nextBtn = document.getElementById('trend-next');
      if (!prevBtn) {
        const tcvParent = tcv && tcv.parentNode;
        if (tcvParent) {
          const controls = document.createElement('div');
          controls.className = 'trend-controls';
          controls.innerHTML = '<button class="btn btn-sm" id="trend-prev">‹</button><span id="trend-month-label" style="margin:0 8px;font-size:14px;"></span><button class="btn btn-sm" id="trend-next">›</button>';
          tcvParent.parentNode.insertBefore(controls, tcvParent);
          prevBtn = document.getElementById('trend-prev'); nextBtn = document.getElementById('trend-next');
        }
      }
      if (prevBtn) {
        document.getElementById('trend-month-label').textContent = `${trendYear}年${trendMonth + 1}月`;
        prevBtn.onclick = () => { trendMonth--; if (trendMonth < 0) { trendMonth = 11; trendYear--; } renderTab(); };
        nextBtn.onclick = () => { trendMonth++; if (trendMonth > 11) { trendMonth = 0; trendYear++; } renderTab(); };
      }
    }
    // 月/年视图切换年份
    if (trendGran !== '日') {
      let prevBtn = document.getElementById('trend-prev'), nextBtn = document.getElementById('trend-next');
      if (!prevBtn) {
        const tcvParent = tcv && tcv.parentNode;
        if (tcvParent) {
          const controls = document.createElement('div');
          controls.className = 'trend-controls';
          controls.innerHTML = '<button class="btn btn-sm" id="trend-prev">‹</button><span id="trend-month-label" style="margin:0 8px;font-size:14px;"></span><button class="btn btn-sm" id="trend-next">›</button>';
          tcvParent.parentNode.insertBefore(controls, tcvParent);
          prevBtn = document.getElementById('trend-prev'); nextBtn = document.getElementById('trend-next');
        }
      }
      if (prevBtn) {
        document.getElementById('trend-month-label').textContent = `${trendYear}年`;
        prevBtn.onclick = () => { trendYear--; renderTab(); };
        nextBtn.onclick = () => { trendYear++; renderTab(); };
      }
    }

    // 明细筛选
    const fm = document.getElementById('fMonth'); if (fm) fm.onchange = e => { fMonth = e.target.value; renderTab(); };
    const ft = document.getElementById('fType'); if (ft) ft.onchange = e => { fType = e.target.value; renderTab(); };
    const fa = document.getElementById('fAccount'); if (fa) fa.onchange = e => { fAccount = e.target.value; renderTab(); };

    // FAB & 增/删/目标/攒钱
    const fab = document.getElementById('fab-add'); if (fab) fab.onclick = () => editRecord(null);
    const add = document.getElementById('add'); if (add) add.onclick = () => editRecord(null);
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editRecord(b.dataset.edit));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!confirm('确定删除该记录？')) return; data().finance = data().finance.filter(r => r.id !== b.dataset.del); save(); renderTab(); });
    const ag = document.getElementById('add-goal'); if (ag) ag.onclick = () => editGoal(null);
    document.querySelectorAll('[data-gedit]').forEach(b => b.onclick = () => editGoal(b.dataset.gedit));
    document.querySelectorAll('[data-gdel]').forEach(b => b.onclick = () => { if (!confirm('确定删除该目标？')) return; data().financeGoals = data().financeGoals.filter(g => g.id !== b.dataset.gdel); save(); renderTab(); });
    const as = document.getElementById('add-save'); if (as) as.onclick = () => editSaving(null);
    document.querySelectorAll('[data-sedit]').forEach(b => b.onclick = () => editSaving(b.dataset.sedit));
    document.querySelectorAll('[data-sdel]').forEach(b => b.onclick = () => { if (!confirm('确定删除该攒钱记录？')) return; data().savings = data().savings.filter(r => r.id !== b.dataset.sdel); save(); renderTab(); });
  }

  function editRecord(id) {
    const r = id ? data().finance.find(x => x.id === id) : null;
    const cats = cfg().defaults.financeCategories || [];
    const accs = accounts();
    const selType = r ? r.type : 'expense';
    const catGrid = cats.map(c => `<button class="cat-btn${(r && r.category === c) || (!r && !selCat && cats[0] === c) ? ' active' : ''}" data-cat="${esc(c)}">${catIcon(c)}<span>${esc(c)}</span></button>`).join('');
    let selCat = r ? r.category : '';
    PBUI.openModal(`
      <div class="sheet-grip"></div>
      <div class="seg" style="margin-bottom:14px;" id="r-seg">
        <button class="seg-btn${selType === 'income' ? ' active' : ''}" data-rtype="income">收入</button>
        <button class="seg-btn${selType === 'expense' ? ' active' : ''}" data-rtype="expense">支出</button>
      </div>
      <div class="r-amount"><input type="number" id="r-amount" min="0" step="0.01" value="${esc(r ? r.amount : '')}" placeholder="0.00" inputmode="decimal"></div>
      <div class="cat-grid" id="cat-grid">${catGrid}</div>
      <div class="form-grid">
        <label class="field"><span class="field-label">账户</span>
          <select id="r-acc">${accs.map(a => `<option value="${a.id}" ${r && r.accountId === a.id ? 'selected' : ''}>${accIcon(a.type)} ${esc(a.name)}</option>`).join('')}</select></label>
        <label class="field"><span class="field-label">日期</span><input type="date" id="r-date" value="${esc(r ? r.date : new Date().toISOString().slice(0, 10))}"></label>
      </div>
      <div class="r-note-toggle" id="r-note-tgl">▸ 添加备注（可选）</div>
      <input type="text" id="r-note" value="${esc(r ? r.note : '')}" placeholder="备注" style="display:none;margin-top:4px;">
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">取消</button><button class="btn btn-primary" id="r-save">✓ 保存</button></div>`, 'modal-sheet');
    // 分段切换
    document.getElementById('r-seg').querySelectorAll('.seg-btn').forEach(b => b.onclick = () => {
      document.getElementById('r-seg').querySelectorAll('.seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
    // 分类九宫格
    document.getElementById('cat-grid').querySelectorAll('.cat-btn').forEach(b => b.onclick = () => {
      document.getElementById('cat-grid').querySelectorAll('.cat-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      selCat = b.dataset.cat;
    });
    // 备注折叠
    document.getElementById('r-note-tgl').onclick = () => {
      const n = document.getElementById('r-note'); const t = document.getElementById('r-note-tgl');
      if (n.style.display === 'none') { n.style.display = ''; t.textContent = '▾ 收起备注'; } else { n.style.display = 'none'; t.textContent = '▸ 添加备注（可选）'; }
    };
    document.getElementById('r-save').onclick = () => {
      const amount = parseFloat(document.getElementById('r-amount').value);
      if (isNaN(amount) || amount < 0) { PBUI.toast('请输入有效金额'); return; }
      if (!selCat) selCat = cats[0] || '其他';
      const obj = {
        type: (document.getElementById('r-seg').querySelector('.seg-btn.active') && document.getElementById('r-seg').querySelector('.seg-btn.active').dataset.rtype) || 'expense',
        amount,
        category: selCat,
        accountId: document.getElementById('r-acc').value,
        date: document.getElementById('r-date').value,
        note: document.getElementById('r-note').value.trim()
      };
      if (r) { Object.assign(r, obj); PB.touch(r); } else { obj.id = PB.uid(); data().finance.push(PB.touch(obj)); }
      save(); PBUI.closeModal(); renderTab();
    };
  }

  function editGoal(id) {
    const g = id ? data().financeGoals.find(x => x.id === id) : null;
    PBUI.openModal(`
      <div class="sheet-grip"></div>
      <h2>${g ? '编辑目标' : '新增目标'}</h2>
      <div class="field"><label>名称</label><input type="text" id="g-name" value="${esc(g ? g.name : '')}" placeholder="如 月度预算 / 旅行基金"></div>
      <div class="field"><label>目标金额</label><input type="number" id="g-target" min="0" step="0.01" value="${esc(g ? g.target : '')}"></div>
      <div class="field"><label>已攒 / 当前</label><input type="number" id="g-current" min="0" step="0.01" value="${esc(g ? g.current : 0)}"></div>
      <div class="field"><label>月份（可选）</label><input type="month" id="g-month" value="${esc(g ? g.month : curMonth())}"></div>
      <div class="field"><label>备注</label><input type="text" id="g-note" value="${esc(g ? g.note : '')}" placeholder="可选"></div>
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">取消</button><button class="btn btn-primary" id="g-save">保存</button></div>`, 'modal-sheet');
    document.getElementById('g-save').onclick = () => {
      const name = document.getElementById('g-name').value.trim();
      if (!name) { PBUI.toast('请填写名称'); return; }
      const target = parseFloat(document.getElementById('g-target').value) || 0;
      const current = parseFloat(document.getElementById('g-current').value) || 0;
      const obj = { name, target, current, month: document.getElementById('g-month').value, note: document.getElementById('g-note').value.trim() };
      if (g) { Object.assign(g, obj); PB.touch(g); } else { obj.id = PB.uid(); data().financeGoals.push(PB.touch(obj)); }
      save(); PBUI.closeModal(); renderTab();
    };
  }

  render();
})();
