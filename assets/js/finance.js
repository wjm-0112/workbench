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
  let fType = '', fMonth = '';
  let finTab = '概览';
  let charts = [];
  const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const money = n => '¥' + (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const monthRecs = arr => arr.filter(r => (r.date || '').slice(0, 7) === (fMonth || curMonth()));
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#1E3A8A';
  const destroyCharts = () => { charts.forEach(c => { try { c.destroy(); } catch (e) {} }); charts = []; };

  function render() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>财政</h1><button class="btn btn-primary" id="add">+ 记账</button></div>
      <div class="fin-filter">
        <label class="ff-item"><span class="ff-ico">${PBUI.icon('calendar')}</span><span class="ff-lab">月份</span><input type="month" id="fMonth" value="${esc(fMonth)}"></label>
        <label class="ff-item"><span class="ff-ico">${PBUI.icon('coins')}</span><span class="ff-lab">类型</span>
          <select id="fType"><option value="">全部</option><option value="income" ${fType === 'income' ? 'selected' : ''}>收入</option><option value="expense" ${fType === 'expense' ? 'selected' : ''}>支出</option></select></label>
      </div>
      <div id="fin-subtabs"></div>
      <div id="fin-tab"></div>`;
    document.getElementById('add').onclick = () => editRecord(null);
    const fm = document.getElementById('fMonth'); if (fm) fm.onchange = e => { fMonth = e.target.value; renderTab(); };
    const ft = document.getElementById('fType'); if (ft) ft.onchange = e => { fType = e.target.value; renderTab(); };
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
    const savedTotal = (d.savings || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const cats = {}; mRecs.filter(r => r.type === 'expense' && (!fType || r.type === fType)).forEach(r => { const k = r.category || '其他'; cats[k] = (cats[k] || 0) + Number(r.amount || 0); });
    const catKeys = Object.keys(cats); const catMax = Math.max(1, ...catKeys.map(k => cats[k]));
    const goals = d.financeGoals || [];

    return `
      <div class="grid-4">
        <div class="stat"><div class="label">收入</div><div class="num flow-in">${money(income)}</div></div>
        <div class="stat"><div class="label">支出</div><div class="num flow-out">${money(expense)}</div></div>
        <div class="stat"><div class="label">结余</div><div class="num">${money(income - expense)}</div></div>
        <div class="stat"><div class="label">累计攒钱</div><div class="num flow-in">${money(savedTotal)}</div></div>
      </div>

      <div class="card">
        <div class="card-head"><h3 style="margin:0;">支出分类占比（${month}）</h3>${catKeys.length ? `<span class="muted-note">${catKeys.length} 类</span>` : ''}</div>
        <div class="split-12">
          <div class="chart-box">${typeof Chart === 'undefined' ? '<p class="muted-note">图表库需联网加载</p>' : (expense ? '<canvas id="cat"></canvas>' : '<p class="muted-note">本月还没有支出记录</p>')}</div>
          <div class="rank-list">
            ${catKeys.length ? catKeys.sort((a, b) => cats[b] - cats[a]).map(k => `<div class="rank-row"><span class="rank-name">${esc(k)}</span><span class="rank-amt">${money(cats[k])}</span></div><div class="progress"><i style="width:${Math.round(cats[k] / catMax * 100)}%"></i></div>`).join('') : '<p class="muted-note">暂无支出分类</p>'}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3 style="margin:0;">预算 / 理财目标</h3><button class="btn btn-sm btn-primary" id="add-goal">+ 新增</button></div>
        <div style="margin-top:4px;">
          ${goals.length ? goals.map(g => {
            const pct = g.target > 0 ? Math.min(100, Math.round((Number(g.current || 0) / Number(g.target)) * 100)) : 0;
            return `<div class="goal">
              <div class="goal-top"><span>${esc(g.name)}${g.month ? ` <span class="muted-note">· ${esc(g.month)}</span>` : ''}</span><span class="muted-note">${money(g.current || 0)} / ${money(g.target)}</span></div>
              <div class="progress"><i style="width:${pct}%"></i></div>
              <div class="actions" style="margin-top:2px;"><button class="rowbtn" data-gedit="${g.id}">编辑</button><button class="rowbtn danger" data-gdel="${g.id}">删除</button></div>
            </div>`;
          }).join('') : '<p class="muted-note">还没有目标，点「新增」制定预算或理财计划</p>'}
        </div>
      </div>`;
  }

  function trendHTML() {
    return `
      <div class="card">
        <div class="card-head"><h3 style="margin:0;">近 6 月收支（绿=收入 / 红=支出）</h3></div>
        <div class="chart-box tall">${typeof Chart === 'undefined' ? '<p class="muted-note">图表库需联网加载（Chart.js CDN）</p>' : '<canvas id="fin6"></canvas>'}</div>
      </div>`;
  }

  function detailHTML() {
    const all = (data().finance || [])
      .filter(r => !fType || r.type === fType)
      .filter(r => !fMonth || (r.date || '').slice(0, 7) === fMonth)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return `
      <div class="card"><h3>收支明细</h3>
        <div class="rec-list">
          ${all.length ? all.map(r => `
            <div class="rec-card" data-id="${r.id}">
              <div class="rec-top"><span class="rec-date">${esc((r.date || '').slice(5) || '—')}</span><span class="chip ${r.type === 'income' ? 'in' : 'out'}">${TYPES[r.type]}</span></div>
              <div class="rec-mid"><span class="rec-cat">${esc(r.category || '—')}</span><span class="rec-account muted-note">${esc(r.account || '')}</span></div>
              <div class="rec-bottom"><span class="rec-amt ${r.type === 'income' ? 'flow-in' : 'flow-out'}">${r.type === 'income' ? '+' : '-'}${money(r.amount)}</span>
                <span class="rec-actions"><button class="rowbtn" data-edit="${r.id}">编辑</button><button class="rowbtn danger" data-del="${r.id}">删除</button></span></div>
              ${r.note ? `<div class="rec-note muted-note">${esc(r.note)}</div>` : ''}
            </div>`).join('') : PBUI.emptyHint('还没有记账，点右上角「记账」')}
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
    PBUI.openModal(`
      <div class="sheet-grip"></div>
      <h2>${r ? '编辑攒钱' : '记一笔攒钱'}</h2>
      <div class="field"><label>金额</label><input type="number" id="s-amount" min="0" step="0.01" value="${esc(r ? r.amount : '')}" placeholder="0.00"></div>
      <div class="field"><label>存储方式</label><input type="text" id="s-method" list="saveMethods" value="${esc(r ? r.method : '')}" placeholder="现金 / 银行卡 / 支付宝…"><datalist id="saveMethods">${methods.map(m => `<option value="${esc(m)}">`).join('')}</datalist></div>
      <div class="field"><label>存储意向</label><input type="text" id="s-intention" value="${esc(r ? r.intention : '')}" placeholder="如 旅游基金 / 买房首付"></div>
      <div class="field"><label>日期</label><input type="date" id="s-date" value="${esc(r ? r.date : new Date().toISOString().slice(0, 10))}"></div>
      <div class="field"><label>备注</label><input type="text" id="s-note" value="${esc(r ? r.note : '')}" placeholder="可选"></div>
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">取消</button><button class="btn btn-primary" id="s-save">保存</button></div>`, 'modal-sheet');
    document.getElementById('s-save').onclick = () => {
      const amount = parseFloat(document.getElementById('s-amount').value);
      if (isNaN(amount) || amount < 0) { PBUI.toast('请输入有效金额'); return; }
      const obj = {
        amount,
        method: document.getElementById('s-method').value.trim(),
        intention: document.getElementById('s-intention').value.trim(),
        date: document.getElementById('s-date').value,
        note: document.getElementById('s-note').value.trim()
      };
      if (r) { Object.assign(r, obj); PB.touch(r); } else { obj.id = PB.uid(); data().savings.push(PB.touch(obj)); }
      save(); PBUI.closeModal(); renderTab();
    };
  }

  function bindTab() {
    const cat = document.getElementById('cat');
    if (cat && typeof Chart !== 'undefined') {
      const d = data(); const mRecs = monthRecs(d.finance || []);
      const cats = {}; mRecs.filter(r => r.type === 'expense').forEach(r => { const k = r.category || '其他'; cats[k] = (cats[k] || 0) + Number(r.amount || 0); });
      const keys = Object.keys(cats);
      if (keys.length) {
        const palette = [cssVar('--primary'), cssVar('--accent'), cssVar('--success'), cssVar('--warn'), cssVar('--purple'), '#60A5FA', '#F472B6', '#34D399', '#FBBF24'];
        charts.push(new Chart(cat, { type: 'doughnut', data: { labels: keys, datasets: [{ data: keys.map(k => cats[k]), backgroundColor: keys.map((_, i) => palette[i % palette.length]) }] }, options: { plugins: { legend: { position: 'bottom', labels: { color: cssVar('--ink') } } } } }));
      }
    }
    const fin6 = document.getElementById('fin6');
    if (fin6 && typeof Chart !== 'undefined') {
      const labels = [], income = [], expense = [];
      const m = new Date();
      for (let i = 5; i >= 0; i--) {
        const dd = new Date(m.getFullYear(), m.getMonth() - i, 1); const key = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`;
        labels.push(`${dd.getMonth() + 1}月`);
        const recs = (data().finance || []).filter(r => (r.date || '').slice(0, 7) === key);
        income.push(recs.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0));
        expense.push(recs.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0));
      }
      charts.push(new Chart(fin6, { type: 'bar', data: { labels, datasets: [{ label: '收入', data: income, backgroundColor: cssVar('--success') }, { label: '支出', data: expense, backgroundColor: cssVar('--accent') }] }, options: { plugins: { legend: { labels: { color: cssVar('--ink') } } }, scales: { x: { ticks: { color: cssVar('--muted') } }, y: { ticks: { color: cssVar('--muted') }, beginAtZero: true } } } }));
    }
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
    const accs = cfg().defaults.financeAccounts || [];
    PBUI.openModal(`
      <div class="sheet-grip"></div>
      <h2>${r ? '编辑记录' : '记一笔'}</h2>
      <div class="field"><label>类型</label>
        <select id="r-type">${Object.keys(TYPES).map(k => `<option value="${k}" ${(r ? r.type : 'expense') === k ? 'selected' : ''}>${TYPES[k]}</option>`).join('')}</select></div>
      <div class="field"><label>金额</label><input type="number" id="r-amount" min="0" step="0.01" value="${esc(r ? r.amount : '')}" placeholder="0.00"></div>
      <div class="field"><label>分类</label><select id="r-cat">${cats.map(c => `<option value="${esc(c)}" ${(r ? r.category : '') === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label>账户</label><input type="text" id="r-account" list="accList" value="${esc(r ? r.account : '')}" placeholder="现金 / 银行卡 / 支付宝…"><datalist id="accList">${accs.map(a => `<option value="${esc(a)}">`).join('')}</datalist></div>
      <div class="field"><label>日期</label><input type="date" id="r-date" value="${esc(r ? r.date : new Date().toISOString().slice(0, 10))}"></div>
      <div class="field"><label>备注</label><input type="text" id="r-note" value="${esc(r ? r.note : '')}" placeholder="可选"></div>
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">取消</button><button class="btn btn-primary" id="r-save">保存</button></div>`, 'modal-sheet');
    document.getElementById('r-save').onclick = () => {
      const amount = parseFloat(document.getElementById('r-amount').value);
      if (isNaN(amount) || amount < 0) { PBUI.toast('请输入有效金额'); return; }
      const obj = {
        type: document.getElementById('r-type').value,
        amount,
        category: document.getElementById('r-cat').value,
        account: document.getElementById('r-account').value.trim(),
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
