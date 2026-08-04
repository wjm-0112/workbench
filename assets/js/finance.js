/* ===== 财政（收支记账 + 预算/理财目标 + 统计） ===== */
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
  let fType = '', fMonth = '';
  let chart = null;
  const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const money = n => '¥' + (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const monthRecs = arr => arr.filter(r => (r.date || '').slice(0, 7) === (fMonth || curMonth()));

  function render() {
    const d = data();
    const month = fMonth || curMonth();
    const all = d.finance || [];
    const mRecs = monthRecs(all);
    const income = mRecs.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = mRecs.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0);
    const cats = {};
    mRecs.filter(r => r.type === 'expense').forEach(r => { const k = r.category || '其他'; cats[k] = (cats[k] || 0) + Number(r.amount || 0); });

    const list = all
      .filter(r => !fType || r.type === fType)
      .filter(r => !fMonth || (r.date || '').slice(0, 7) === fMonth)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    const goals = d.financeGoals || [];

    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>财政</h1><button class="btn btn-primary" id="add">+ 记账</button></div>

      <div class="grid-3">
        <div class="stat"><div class="label">本月收入</div><div class="num flow-in">${money(income)}</div></div>
        <div class="stat"><div class="label">本月支出</div><div class="num flow-out">${money(expense)}</div></div>
        <div class="stat"><div class="label">本月结余</div><div class="num">${money(income - expense)}</div></div>
      </div>

      <div class="card"><h3>支出分类占比（${month}）</h3><div style="max-width:360px;"><canvas id="cat" height="200"></canvas></div>
        ${typeof Chart === 'undefined' ? '<p class="muted-note">（图表库需联网加载，当前离线未显示）</p>' : (expense ? '' : '<p class="muted-note">本月还没有支出记录</p>')}</div>

      <div class="toolbar">
        <input type="month" id="fMonth" value="${esc(fMonth)}" style="max-width:180px;">
        <select id="fType"><option value="">全部类型</option><option value="income" ${fType === 'income' ? 'selected' : ''}>收入</option><option value="expense" ${fType === 'expense' ? 'selected' : ''}>支出</option></select>
      </div>

      <div class="card"><h3>收支记录</h3>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>日期</th><th>类型</th><th>分类</th><th>账户</th><th>金额</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>
              ${list.length ? list.map(r => `
                <tr data-id="${r.id}">
                  <td>${esc((r.date || '').slice(5) || '—')}</td>
                  <td><span class="chip ${r.type === 'income' ? 'in' : 'out'}">${TYPES[r.type]}</span></td>
                  <td>${esc(r.category || '—')}</td>
                  <td>${esc(r.account || '—')}</td>
                  <td class="${r.type === 'income' ? 'flow-in' : 'flow-out'}">${r.type === 'income' ? '+' : '-'}${money(r.amount)}</td>
                  <td class="muted note-cell">${esc((r.note || '').slice(0, 16)) || '—'}</td>
                  <td class="actions"><button class="rowbtn" data-edit="${r.id}">编辑</button><button class="rowbtn danger" data-del="${r.id}">删除</button></td>
                </tr>`).join('') : `<tr><td colspan="7">${PBUI.emptyHint('还没有记账，点右上角「记账」')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;">预算 / 理财目标</h3>
          <button class="btn btn-sm btn-primary" id="add-goal">+ 新增目标</button>
        </div>
        <div style="margin-top:8px;">
          ${goals.length ? goals.map(g => {
            const pct = g.target > 0 ? Math.min(100, Math.round((Number(g.current || 0) / Number(g.target)) * 100)) : 0;
            return `<div class="goal">
              <div class="goal-top"><span>${esc(g.name)}${g.month ? ` <span class="muted-note">· ${esc(g.month)}</span>` : ''}</span><span class="muted-note">${money(g.current || 0)} / ${money(g.target)}</span></div>
              <div class="progress"><i style="width:${pct}%"></i></div>
              <div class="actions" style="margin-top:2px;"><button class="rowbtn" data-gedit="${g.id}">编辑</button><button class="rowbtn danger" data-gdel="${g.id}">删除</button></div>
            </div>`;
          }).join('') : '<p class="muted-note">还没有目标，点「新增目标」制定预算或理财计划</p>'}
        </div>
      </div>`;
    bind();
    renderChart(cats);
  }

  function renderChart(cats) {
    const el = document.getElementById('cat');
    if (!el || typeof Chart === 'undefined') return;
    if (chart) { chart.destroy(); chart = null; }
    const keys = Object.keys(cats);
    if (!keys.length) return;
    const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#1E3A8A';
    const palette = [cssVar('--primary'), cssVar('--accent'), cssVar('--success'), cssVar('--warn'), cssVar('--purple'), '#60A5FA', '#F472B6', '#34D399', '#FBBF24'];
    chart = new Chart(el, {
      type: 'doughnut',
      data: { labels: keys, datasets: [{ data: keys.map(k => cats[k]), backgroundColor: keys.map((_, i) => palette[i % palette.length]) }] },
      options: { plugins: { legend: { position: 'bottom', labels: { color: cssVar('--ink') } } } }
    });
  }

  function bind() {
    document.getElementById('add').onclick = () => editRecord(null);
    const fm = document.getElementById('fMonth'); if (fm) fm.onchange = e => { fMonth = e.target.value; render(); };
    const ft = document.getElementById('fType'); if (ft) ft.onchange = e => { fType = e.target.value; render(); };
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editRecord(b.dataset.edit));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!confirm('确定删除该记录？')) return; data().finance = data().finance.filter(r => r.id !== b.dataset.del); save(); render(); });
    const ag = document.getElementById('add-goal'); if (ag) ag.onclick = () => editGoal(null);
    document.querySelectorAll('[data-gedit]').forEach(b => b.onclick = () => editGoal(b.dataset.gedit));
    document.querySelectorAll('[data-gdel]').forEach(b => b.onclick = () => { if (!confirm('确定删除该目标？')) return; data().financeGoals = data().financeGoals.filter(g => g.id !== b.dataset.gdel); save(); render(); });
  }

  function editRecord(id) {
    const r = id ? data().finance.find(x => x.id === id) : null;
    const cats = cfg().defaults.financeCategories || [];
    PBUI.openModal(`
      <h2>${r ? '编辑记录' : '记一笔'}</h2>
      <div class="field"><label>类型</label>
        <select id="r-type">${Object.keys(TYPES).map(k => `<option value="${k}" ${(r ? r.type : 'expense') === k ? 'selected' : ''}>${TYPES[k]}</option>`).join('')}</select></div>
      <div class="field"><label>金额</label><input type="number" id="r-amount" min="0" step="0.01" value="${esc(r ? r.amount : '')}" placeholder="0.00"></div>
      <div class="field"><label>分类</label><select id="r-cat">${cats.map(c => `<option value="${esc(c)}" ${(r ? r.category : '') === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label>账户</label><input type="text" id="r-account" value="${esc(r ? r.account : '')}" placeholder="现金 / 银行卡 / 支付宝…"></div>
      <div class="field"><label>日期</label><input type="date" id="r-date" value="${esc(r ? r.date : new Date().toISOString().slice(0, 10))}"></div>
      <div class="field"><label>备注</label><input type="text" id="r-note" value="${esc(r ? r.note : '')}" placeholder="可选"></div>
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">取消</button><button class="btn btn-primary" id="r-save">保存</button></div>`);
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
      save(); PBUI.closeModal(); render();
    };
  }

  function editGoal(id) {
    const g = id ? data().financeGoals.find(x => x.id === id) : null;
    PBUI.openModal(`
      <h2>${g ? '编辑目标' : '新增目标'}</h2>
      <div class="field"><label>名称</label><input type="text" id="g-name" value="${esc(g ? g.name : '')}" placeholder="如 月度预算 / 旅行基金"></div>
      <div class="field"><label>目标金额</label><input type="number" id="g-target" min="0" step="0.01" value="${esc(g ? g.target : '')}"></div>
      <div class="field"><label>已攒 / 当前</label><input type="number" id="g-current" min="0" step="0.01" value="${esc(g ? g.current : 0)}"></div>
      <div class="field"><label>月份（可选）</label><input type="month" id="g-month" value="${esc(g ? g.month : curMonth())}"></div>
      <div class="field"><label>备注</label><input type="text" id="g-note" value="${esc(g ? g.note : '')}" placeholder="可选"></div>
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">取消</button><button class="btn btn-primary" id="g-save">保存</button></div>`);
    document.getElementById('g-save').onclick = () => {
      const name = document.getElementById('g-name').value.trim();
      if (!name) { PBUI.toast('请填写名称'); return; }
      const target = parseFloat(document.getElementById('g-target').value) || 0;
      const current = parseFloat(document.getElementById('g-current').value) || 0;
      const obj = { name, target, current, month: document.getElementById('g-month').value, note: document.getElementById('g-note').value.trim() };
      if (g) { Object.assign(g, obj); PB.touch(g); } else { obj.id = PB.uid(); data().financeGoals.push(PB.touch(obj)); }
      save(); PBUI.closeModal(); render();
    };
  }

  render();
})();
