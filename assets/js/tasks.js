/* ===== 任务（表格化 + 批量/搜索/排序/筛选） ===== */
(async function () {
  const esc = PBUI.esc;
  const save = () => PB.save();
  const STATUS = { todo: '待办', doing: '进行中', done: '已完成' };
  const STATUS_CLASS = { todo: 'status-todo', doing: 'status-doing', done: 'status-done' };

  if (!await PBUI.ensureUnlocked()) return;
  // 模块被禁用则跳转首个启用模块
  const mods = PB.getConfig().modules.filter(m => m.enabled !== false);
  if (!mods.find(m => m.key === 'tasks')) { location.href = (mods[0] && mods[0].key === 'dashboard' ? 'index.html' : mods[0].key + '.html') || 'index.html'; return; }
  PBUI.applyTheme(PB.getConfig().theme);
  PBUI.renderChrome('tasks');
  await PBUI.afterUnlockSync();

  const data = () => PB.getData();
  const norm = t => { t.status = t.status || 'todo'; t.tags = t.tags || []; return t; };
  let selected = new Set();
  let sortKey = 'due', sortDir = 1;
  let q = '', fStatus = '', fTag = '';

  function allTags() {
    const s = new Set(); data().tasks.forEach(t => (t.tags || []).forEach(x => s.add(x))); return Array.from(s);
  }

  function filtered() {
    let list = data().tasks.map(norm);
    if (q) { const low = q.toLowerCase(); list = list.filter(t => (t.title || '').toLowerCase().includes(low) || (t.tags || []).join(' ').toLowerCase().includes(low)); }
    if (fStatus) list = list.filter(t => t.status === fStatus);
    if (fTag) list = list.filter(t => (t.tags || []).includes(fTag));
    list.sort((a, b) => {
      let va, vb;
      if (sortKey === 'title') { va = a.title || ''; vb = b.title || ''; return va.localeCompare(vb, 'zh') * sortDir; }
      if (sortKey === 'status') { va = ['todo', 'doing', 'done'].indexOf(a.status); vb = ['todo', 'doing', 'done'].indexOf(b.status); }
      else { va = a.due || ''; vb = b.due || ''; }
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
    });
    return list;
  }

  function render() {
    const list = filtered();
    const tags = allTags();
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>任务</h1><button class="btn btn-primary" id="add">+ 新建任务</button></div>
      <div class="toolbar">
        <input type="search" id="q" placeholder="搜索标题/标签" value="${esc(q)}">
        <select id="fStatus"><option value="">全部状态</option>${Object.keys(STATUS).map(k => `<option value="${k}" ${fStatus === k ? 'selected' : ''}>${STATUS[k]}</option>`).join('')}</select>
        <select id="fTag"><option value="">全部分类</option>${tags.map(t => `<option value="${esc(t)}" ${fTag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </div>
      <div class="batch-bar ${selected.size ? '' : 'hidden'}" id="batch">
        <span class="count">已选 ${selected.size} 项</span>
        <button class="btn btn-sm" id="b-done">标记已完成</button>
        <button class="btn btn-sm" id="b-tag">加标签</button>
        <button class="btn btn-sm btn-accent" id="b-del">删除</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th class="col-check"><input type="checkbox" id="checkAll"></th>
            <th class="sortable" data-sort="title">标题</th>
            <th class="sortable" data-sort="status">状态</th>
            <th class="sortable" data-sort="due">截止</th>
            <th>标签</th>
            <th>操作</th>
          </tr></thead>
          <tbody>
            ${list.length ? list.map(t => `
              <tr class="${selected.has(t.id) ? 'selected' : ''}" data-id="${t.id}">
                <td class="col-check"><input type="checkbox" class="rowcheck" data-id="${t.id}" ${selected.has(t.id) ? 'checked' : ''}></td>
                <td>${esc(t.title || '')}</td>
                <td><span class="chip ${STATUS_CLASS[t.status]}">${STATUS[t.status]}</span></td>
                <td>${esc(t.due || '—')}</td>
                <td>${(t.tags || []).map(x => `<span class="chip">${esc(x)}</span>`).join(' ')}</td>
                <td class="actions"><button class="rowbtn" data-edit="${t.id}">编辑</button><button class="rowbtn danger" data-del="${t.id}">删除</button></td>
              </tr>`).join('') : `<tr><td colspan="6">${PBUI.emptyHint('还没有任务，点右上角新建')}</td></tr>`}
          </tbody>
        </table>
      </div>`;
    bind();
  }

  function bind() {
    document.getElementById('add').onclick = () => editTask(null);
    document.getElementById('q').oninput = e => { q = e.target.value; render(); };
    document.getElementById('fStatus').onchange = e => { fStatus = e.target.value; render(); };
    document.getElementById('fTag').onchange = e => { fTag = e.target.value; render(); };
    document.querySelectorAll('.sortable').forEach(th => th.onclick = () => {
      const k = th.dataset.sort; if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; } render();
    });
    const checkAll = document.getElementById('checkAll');
    checkAll.onchange = () => { filtered().forEach(t => { if (checkAll.checked) selected.add(t.id); else selected.delete(t.id); }); render(); };
    document.querySelectorAll('.rowcheck').forEach(cb => cb.onchange = () => {
      const id = cb.dataset.id; if (cb.checked) selected.add(id); else selected.delete(id); render();
    });
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editTask(b.dataset.edit));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (!confirm('确定删除该任务？')) return;
      data().tasks = data().tasks.filter(t => t.id !== b.dataset.del); save(); render();
    });
    const batch = document.getElementById('batch');
    if (batch && selected.size) {
      document.getElementById('b-done').onclick = () => { selected.forEach(id => { const t = data().tasks.find(x => x.id === id); if (t) { t.status = 'done'; PB.touch(t); } }); save(); render(); PBUI.toast('已标记完成'); };
      document.getElementById('b-tag').onclick = () => {
        const tag = prompt('输入要添加的标签：'); if (!tag) return;
        selected.forEach(id => { const t = data().tasks.find(x => x.id === id); if (t) { t.tags = t.tags || []; if (!t.tags.includes(tag)) t.tags.push(tag); PB.touch(t); } }); save(); render(); PBUI.toast('已添加标签');
      };
      document.getElementById('b-del').onclick = () => {
        if (!confirm('确定删除选中的 ' + selected.size + ' 项？')) return;
        data().tasks = data().tasks.filter(t => !selected.has(t.id)); selected.clear(); save(); render();
      };
    }
  }

  function editTask(id) {
    const t = id ? data().tasks.find(x => x.id === id) : null;
    const defTags = PB.getConfig().defaults.taskTags;
    PBUI.openModal(`
      <h2>${t ? '编辑任务' : '新建任务'}</h2>
      <div class="field"><label>标题</label><input type="text" id="t-title" value="${esc(t ? t.title : '')}"></div>
      <div class="field"><label>状态</label><select id="t-status">${Object.keys(STATUS).map(k => `<option value="${k}" ${(t ? t.status : 'todo') === k ? 'selected' : ''}>${STATUS[k]}</option>`).join('')}</select></div>
      <div class="field"><label>截止日期</label><input type="date" id="t-due" value="${esc(t ? t.due : '')}"></div>
      <div class="field"><label>标签（逗号分隔）</label><input type="text" id="t-tags" value="${esc(t ? (t.tags || []).join(',') : defTags.join(','))}" placeholder="工作,学习"></div>
      <div class="modal-foot">
        <button class="btn" onclick="PBUI.closeModal()">取消</button>
        <button class="btn btn-primary" id="t-save">保存</button>
      </div>`);
    document.getElementById('t-save').onclick = () => {
      const title = document.getElementById('t-title').value.trim();
      if (!title) { PBUI.toast('标题不能为空'); return; }
      const tags = document.getElementById('t-tags').value.split(',').map(s => s.trim()).filter(Boolean);
      if (t) { t.title = title; t.status = document.getElementById('t-status').value; t.due = document.getElementById('t-due').value; t.tags = tags; PB.touch(t); }
      else { data().tasks.push(PB.touch({ id: PB.uid(), title, status: document.getElementById('t-status').value, due: document.getElementById('t-due').value, tags })); }
      save(); PBUI.closeModal(); render();
    };
  }

  render();
})();
