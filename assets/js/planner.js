/* ===== 综合（任务 + 笔记，顶部 tab 切换；修复搜索丢焦点） ===== */
(async function () {
  const esc = PBUI.esc;
  const save = () => PB.save();
  const STATUS = { todo: '待办', doing: '进行中', done: '已完成' };
  const STATUS_CLASS = { todo: 'status-todo', doing: 'status-doing', done: 'status-done' };

  if (!await PBUI.ensureUnlocked()) return;
  const cfg = () => PB.getConfig();
  const mods = cfg().modules.filter(m => m.enabled !== false);
  if (!mods.find(m => m.key === 'planner')) {
    const first = mods[0];
    location.href = first ? (first.key === 'dashboard' ? 'index.html' : (PAGE_HREF[first.key] || first.href || 'index.html')) : 'index.html';
    return;
  }
  PBUI.applyTheme(cfg().theme);
  PBUI.renderChrome('planner');
  await PBUI.afterUnlockSync();

  const data = () => PB.getData();
  let sub = 'tasks';                 // 'tasks' | 'notes'
  let selected = new Set();
  const f = { tasks: { q: '', status: '', tag: '', from: '', to: '' }, notes: { q: '', tag: '', from: '', to: '' } };
  let sortKey = 'due', sortDir = 1;
  let noteSort = 'updated', noteDir = -1;

  function allTaskTags() { const s = new Set(); data().tasks.forEach(t => (t.tags || []).forEach(x => s.add(x))); return Array.from(s); }
  function allNoteTags() { const s = new Set(); data().notes.forEach(n => (n.tags || []).forEach(x => s.add(x))); return Array.from(s); }

  function tasksFiltered() {
    let list = data().tasks.map(t => { t.status = t.status || 'todo'; t.tags = t.tags || []; return t; });
    const ff = f.tasks;
    if (ff.q) { const low = ff.q.toLowerCase(); list = list.filter(t => (t.title || '').toLowerCase().includes(low) || (t.tags || []).join(' ').toLowerCase().includes(low)); }
    if (ff.status) list = list.filter(t => t.status === ff.status);
    if (ff.tag) list = list.filter(t => (t.tags || []).includes(ff.tag));
    if (ff.from) list = list.filter(t => t.due && t.due >= ff.from);
    if (ff.to) list = list.filter(t => t.due && t.due <= ff.to);
    list.sort((a, b) => {
      let va, vb;
      if (sortKey === 'title') { va = a.title || ''; vb = b.title || ''; return va.localeCompare(vb, 'zh') * sortDir; }
      if (sortKey === 'status') { va = ['todo', 'doing', 'done'].indexOf(a.status); vb = ['todo', 'doing', 'done'].indexOf(b.status); }
      else { va = a.due || ''; vb = b.due || ''; }
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
    });
    return list;
  }
  function notesFiltered() {
    let list = data().notes.map(n => { n.tags = n.tags || []; return n; });
    const ff = f.notes;
    if (ff.q) { const low = ff.q.toLowerCase(); list = list.filter(n => (n.title || '').toLowerCase().includes(low) || (n.body || '').toLowerCase().includes(low) || (n.tags || []).join(' ').toLowerCase().includes(low)); }
    if (ff.tag) list = list.filter(n => (n.tags || []).includes(ff.tag));
    if (ff.from) list = list.filter(n => (n.updatedAt || '').slice(0, 10) >= ff.from);
    if (ff.to) list = list.filter(n => (n.updatedAt || '').slice(0, 10) <= ff.to);
    list.sort((a, b) => { let va = a.updatedAt || '', vb = b.updatedAt || ''; if (noteSort === 'title') { va = a.title || ''; vb = b.title || ''; return va.localeCompare(vb, 'zh') * noteDir; } return (va < vb ? -1 : va > vb ? 1 : 0) * noteDir; });
    return list;
  }

  // 外壳（含搜索/筛选/批量条）只在切换子 tab 时重建；列表只重渲 tbody，保搜索焦点
  function renderShell() {
    const content = document.getElementById('content');
    const ff = sub === 'tasks' ? f.tasks : f.notes;
    const tags = sub === 'tasks' ? allTaskTags() : allNoteTags();
    content.innerHTML = `
      <div class="page-head">
        <div class="subtabs">
          <button class="subtab ${sub === 'tasks' ? 'active' : ''}" data-sub="tasks">任务</button>
          <button class="subtab ${sub === 'notes' ? 'active' : ''}" data-sub="notes">笔记</button>
        </div>
        <button class="btn btn-primary" id="add">+ 新建${sub === 'tasks' ? '任务' : '笔记'}</button>
      </div>
      <div class="toolbar">
        <input type="search" id="q" placeholder="搜索标题/标签${sub === 'notes' ? '/内容' : ''}" value="${esc(ff.q)}">
        ${sub === 'tasks' ? `<select id="fStatus"><option value="">全部状态</option>${Object.keys(STATUS).map(k => `<option value="${k}" ${ff.status === k ? 'selected' : ''}>${STATUS[k]}</option>`).join('')}</select>` : ''}
        <select id="fTag"><option value="">全部分类</option>${tags.map(t => `<option value="${esc(t)}" ${ff.tag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <input type="date" id="fFrom" value="${esc(ff.from)}" title="起始日期（${sub === 'tasks' ? '截止日' : '更新日'}）">
        <input type="date" id="fTo" value="${esc(ff.to)}" title="截止日期（${sub === 'tasks' ? '截止日' : '更新日'}）">
      </div>
      <div class="batch-bar ${selected.size ? '' : 'hidden'}" id="batch">
        <span class="count">已选 ${selected.size} 项</span>
        ${sub === 'tasks' ? `<button class="btn btn-sm" id="b-done">标记已完成</button><button class="btn btn-sm" id="b-tag">加标签</button>` : ''}
        <button class="btn btn-sm btn-accent" id="b-del">删除</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr id="thead-row"></tr></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>`;
    content.querySelectorAll('.subtab').forEach(b => b.onclick = () => { if (b.dataset.sub === sub) return; sub = b.dataset.sub; selected.clear(); renderShell(); });
    document.getElementById('add').onclick = () => sub === 'tasks' ? editTask(null) : editNote(null);
    document.getElementById('q').oninput = e => { (sub === 'tasks' ? f.tasks : f.notes).q = e.target.value; renderBody(); };
    const ftag = document.getElementById('fTag'); if (ftag) ftag.onchange = e => { (sub === 'tasks' ? f.tasks : f.notes).tag = e.target.value; renderBody(); };
    const fst = document.getElementById('fStatus'); if (fst) fst.onchange = e => { f.tasks.status = e.target.value; renderBody(); };
    const ffrom = document.getElementById('fFrom'); if (ffrom) ffrom.onchange = e => { ff.from = e.target.value; renderBody(); };
    const fto = document.getElementById('fTo'); if (fto) fto.onchange = e => { ff.to = e.target.value; renderBody(); };
    const batch = document.getElementById('batch');
    if (batch) {
      const bd = document.getElementById('b-del'); if (bd) bd.onclick = () => { if (!confirm('确定删除选中的 ' + selected.size + ' 项？')) return; if (sub === 'tasks') data().tasks = data().tasks.filter(t => !selected.has(t.id)); else data().notes = data().notes.filter(n => !selected.has(n.id)); selected.clear(); save(); renderBody(); };
      const bdone = document.getElementById('b-done'); if (bdone) bdone.onclick = () => { selected.forEach(id => { const t = data().tasks.find(x => x.id === id); if (t) { t.status = 'done'; PB.touch(t); } }); save(); renderBody(); PBUI.toast('已标记完成'); };
      const btag = document.getElementById('b-tag'); if (btag) btag.onclick = () => { const tag = prompt('输入要添加的标签：'); if (!tag) return; selected.forEach(id => { const t = data().tasks.find(x => x.id === id); if (t) { t.tags = t.tags || []; if (!t.tags.includes(tag)) t.tags.push(tag); PB.touch(t); } }); save(); renderBody(); PBUI.toast('已添加标签'); };
    }
    renderBody();
  }

  function renderBody() {
    const thead = document.getElementById('thead-row');
    const tbody = document.getElementById('tbody');
    if (!tbody) return;
    if (sub === 'tasks') {
      const list = tasksFiltered();
      thead.innerHTML = `<th class="col-check"><input type="checkbox" id="checkAll"></th><th class="sortable" data-sort="title">标题</th><th class="sortable" data-sort="status">状态</th><th class="sortable" data-sort="due">截止</th><th>标签</th><th>备注</th><th>操作</th>`;
      tbody.innerHTML = list.length ? list.map(t => `
        <tr class="${selected.has(t.id) ? 'selected' : ''}" data-id="${t.id}">
          <td class="col-check"><input type="checkbox" class="rowcheck" data-id="${t.id}" ${selected.has(t.id) ? 'checked' : ''}></td>
          <td data-label="标题">${esc(t.title || '')}</td>
          <td data-label="状态"><span class="chip ${STATUS_CLASS[t.status]}">${STATUS[t.status]}</span></td>
          <td data-label="截止">${esc(t.due ? PBUI.fmtDate(t.due) : '—')}</td>
          <td data-label="标签">${(t.tags || []).map(x => `<span class="chip">${esc(x)}</span>`).join(' ')}</td>
          <td class="muted note-cell" data-label="备注">${esc((t.note || '').slice(0, 16)) || '—'}</td>
          <td class="actions" data-label="操作"><button class="rowbtn" data-edit="${t.id}">编辑</button><button class="rowbtn danger" data-del="${t.id}">删除</button></td>
        </tr>`).join('') : `<tr><td colspan="7">${PBUI.emptyHint('还没有任务，点右上角新建')}</td></tr>`;
    } else {
      const list = notesFiltered();
      thead.innerHTML = `<th class="col-check"><input type="checkbox" id="checkAll"></th><th class="sortable" data-sort="title">标题</th><th>标签</th><th class="sortable" data-sort="updated">更新</th><th>操作</th>`;
      tbody.innerHTML = list.length ? list.map(n => `
        <tr class="${selected.has(n.id) ? 'selected' : ''}" data-id="${n.id}">
          <td class="col-check"><input type="checkbox" class="rowcheck" data-id="${n.id}" ${selected.has(n.id) ? 'checked' : ''}></td>
          <td data-label="标题">${esc(n.title || '')}</td>
          <td data-label="标签">${(n.tags || []).map(x => `<span class="chip">${esc(x)}</span>`).join(' ')}</td>
          <td data-label="更新">${esc(PBUI.fmtDate(n.updatedAt))}</td>
          <td class="actions" data-label="操作"><button class="rowbtn" data-view="${n.id}">查看</button><button class="rowbtn" data-edit="${n.id}">编辑</button><button class="rowbtn danger" data-del="${n.id}">删除</button></td>
        </tr>`).join('') : `<tr><td colspan="5">${PBUI.emptyHint('还没有笔记，点右上角新建')}</td></tr>`;
    }
    bindBody();
    toggleBatch();
  }

  function bindBody() {
    const ca = document.getElementById('checkAll');
    if (ca) ca.onchange = () => { const list = sub === 'tasks' ? tasksFiltered() : notesFiltered(); list.forEach(t => { if (ca.checked) selected.add(t.id); else selected.delete(t.id); }); renderBody(); };
    document.querySelectorAll('.rowcheck').forEach(cb => cb.onchange = () => { const id = cb.dataset.id; if (cb.checked) selected.add(id); else selected.delete(id); renderBody(); });
    document.querySelectorAll('.sortable').forEach(th => th.onclick = () => { const k = th.dataset.sort; if (sub === 'tasks') { if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; } } else { if (noteSort === k) noteDir *= -1; else { noteSort = k; noteDir = 1; } } renderBody(); });
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => sub === 'tasks' ? editTask(b.dataset.edit) : editNote(b.dataset.edit));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!confirm('确定删除？')) return; if (sub === 'tasks') data().tasks = data().tasks.filter(t => t.id !== b.dataset.del); else data().notes = data().notes.filter(n => n.id !== b.dataset.del); save(); renderBody(); });
    document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => viewNote(b.dataset.view));
  }

  function toggleBatch() {
    const batch = document.getElementById('batch');
    if (!batch) return;
    batch.classList.toggle('hidden', selected.size === 0);
    const cnt = batch.querySelector('.count'); if (cnt) cnt.textContent = '已选 ' + selected.size + ' 项';
  }

  /* ---------- 任务编辑 ---------- */
  function editTask(id) {
    const t = id ? data().tasks.find(x => x.id === id) : null;
    const defTags = cfg().defaults.taskTags;
    PBUI.openModal(`
      <h2>${t ? '编辑任务' : '新建任务'}</h2>
      <div class="field"><label>标题</label><input type="text" id="t-title" value="${esc(t ? t.title : '')}"></div>
      <div class="field"><label>状态</label><select id="t-status">${Object.keys(STATUS).map(k => `<option value="${k}" ${(t ? t.status : 'todo') === k ? 'selected' : ''}>${STATUS[k]}</option>`).join('')}</select></div>
      <div class="field"><label>截止日期</label><input type="date" id="t-due" value="${esc(t ? t.due : '')}"></div>
      <div class="field"><label>标签（逗号分隔）</label><input type="text" id="t-tags" value="${esc(t ? (t.tags || []).join(',') : defTags.join(','))}" placeholder="工作,学习"></div>
      <div class="field"><label>备注</label><textarea id="t-note" rows="2" placeholder="补充说明（可选）">${esc(t ? (t.note || '') : '')}</textarea></div>
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">取消</button><button class="btn btn-primary" id="t-save">保存</button></div>`);
    document.getElementById('t-save').onclick = () => {
      const title = document.getElementById('t-title').value.trim();
      if (!title) { PBUI.toast('标题不能为空'); return; }
      const tags = document.getElementById('t-tags').value.split(',').map(s => s.trim()).filter(Boolean);
      const note = document.getElementById('t-note').value.trim();
      if (t) { t.title = title; t.status = document.getElementById('t-status').value; t.due = document.getElementById('t-due').value; t.tags = tags; t.note = note; PB.touch(t); }
      else data().tasks.push(PB.touch({ id: PB.uid(), title, status: document.getElementById('t-status').value, due: document.getElementById('t-due').value, tags, note }));
      save(); PBUI.closeModal(); renderBody();
    };
  }

  /* ---------- 笔记查看 / 编辑 ---------- */
  function hl(text, term) { const e = esc(text); if (!term) return e; const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return e.replace(new RegExp('(' + safe + ')', 'gi'), '<mark>$1</mark>'); }
  function sanitize(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*"[^"]*"/gi, '').replace(/\son\w+\s*=\s*'[^']*'/gi, '').replace(/javascript:/gi, ''); }
  function renderMarkdown(body) {
    const raw = body || '';
    if (typeof marked === 'undefined') return esc(raw).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
    try { return sanitize(marked.parse(raw, { breaks: true })); } catch (e) { return esc(raw).replace(/\n/g, '<br>'); }
  }
  function buildToc(body) { const out = []; let inCode = false; (body || '').split('\n').forEach(ln => { if (ln.trim().startsWith('```')) { inCode = !inCode; return; } const m = ln.match(/^(#{1,3})\s+(.*)$/); if (m && !inCode) out.push(esc(m[2])); }); return out; }
  function viewNote(id) {
    const n = data().notes.find(x => x.id === id); if (!n) return;
    const toc = buildToc(n.body); const links = (n.links || []).filter(Boolean);
    PBUI.openModal(`
      <h2>${hl(n.title || '', f.notes.q)}</h2>
      <div class="muted-note">${(n.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join(' ')}</div>
      ${links.length ? `<div class="links-box">${links.map(l => `<a class="link-pill" href="${esc(l)}" target="_blank" rel="noopener">🔗 ${esc(l)}</a>`).join('')}</div>` : ''}
      ${toc.length ? `<div class="toc"><b>目录</b>${toc.map(t => `<span>${t}</span>`).join('')}</div>` : ''}
      <div class="prose">${renderMarkdown(n.body)}</div>
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">关闭</button><button class="btn btn-primary" id="v-edit">编辑</button></div>`);
    document.getElementById('v-edit').onclick = () => { PBUI.closeModal(); editNote(id); };
  }
  function editNote(id) {
    const n = id ? data().notes.find(x => x.id === id) : null;
    PBUI.openModal(`
      <h2>${n ? '编辑笔记' : '新建笔记'}</h2>
      <div class="field"><label>标题</label><input type="text" id="n-title" value="${esc(n ? n.title : '')}"></div>
      <div class="field"><label>标签（逗号分隔）</label><input type="text" id="n-tags" value="${esc(n ? (n.tags || []).join(',') : '')}" placeholder="工作,灵感"></div>
      <div class="field"><label>网页链接（每行一个，自动生成可点链接）</label><textarea id="n-links" rows="2" placeholder="https://example.com">${esc(n ? (n.links || []).join('\n') : '')}</textarea></div>
      <div class="field"><label>内容（支持 Markdown：# 标题、**加粗**、列表、[链接](url)）</label><textarea id="n-body" style="min-height:200px;">${esc(n ? n.body : '')}</textarea></div>
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">取消</button><button class="btn btn-primary" id="n-save">保存</button></div>`);
    document.getElementById('n-save').onclick = () => {
      const title = document.getElementById('n-title').value.trim();
      if (!title) { PBUI.toast('标题不能为空'); return; }
      const tags = document.getElementById('n-tags').value.split(',').map(s => s.trim()).filter(Boolean);
      const links = document.getElementById('n-links').value.split('\n').map(s => s.trim()).filter(Boolean);
      const body = document.getElementById('n-body').value;
      if (n) { n.title = title; n.tags = tags; n.links = links; n.body = body; PB.touch(n); }
      else data().notes.push(PB.touch({ id: PB.uid(), title, tags, links, body }));
      save(); PBUI.closeModal(); renderBody();
    };
  }

  renderShell();
})();
