/* ===== 笔记（表格化 + 搜索/标签 + 详情 TOC/高亮） ===== */
(async function () {
  const esc = PBUI.esc;
  const save = () => PB.save();

  if (!await PBUI.ensureUnlocked()) return;
  const mods = PB.getConfig().modules.filter(m => m.enabled !== false);
  if (!mods.find(m => m.key === 'notes')) { location.href = (mods[0] && (mods[0].key === 'dashboard' ? 'index.html' : mods[0].key + '.html')) || 'index.html'; return; }
  PBUI.applyTheme(PB.getConfig().theme);
  PBUI.renderChrome('notes');
  await PBUI.afterUnlockSync();

  const data = () => PB.getData();
  let selected = new Set();
  let q = '', fTag = '';
  let sortKey = 'updated', sortDir = -1;

  function allTags() { const s = new Set(); data().notes.forEach(n => (n.tags || []).forEach(x => s.add(x))); return Array.from(s); }
  function filtered() {
    let list = data().notes.map(n => { n.tags = n.tags || []; return n; });
    if (q) { const low = q.toLowerCase(); list = list.filter(n => (n.title || '').toLowerCase().includes(low) || (n.body || '').toLowerCase().includes(low) || (n.tags || []).join(' ').toLowerCase().includes(low)); }
    if (fTag) list = list.filter(n => (n.tags || []).includes(fTag));
    list.sort((a, b) => { let va = a.updatedAt || '', vb = b.updatedAt || ''; if (sortKey === 'title') { va = a.title || ''; vb = b.title || ''; return va.localeCompare(vb, 'zh') * sortDir; } return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir; });
    return list;
  }

  function render() {
    const list = filtered();
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>笔记</h1><button class="btn btn-primary" id="add">+ 新建笔记</button></div>
      <div class="toolbar">
        <input type="search" id="q" placeholder="搜索标题/内容/标签" value="${esc(q)}">
        <select id="fTag"><option value="">全部分类</option>${allTags().map(t => `<option value="${esc(t)}" ${fTag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </div>
      <div class="batch-bar ${selected.size ? '' : 'hidden'}" id="batch">
        <span class="count">已选 ${selected.size} 项</span>
        <button class="btn btn-sm btn-accent" id="b-del">删除</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th class="col-check"><input type="checkbox" id="checkAll"></th>
            <th class="sortable" data-sort="title">标题</th>
            <th>标签</th>
            <th class="sortable" data-sort="updated">更新</th>
            <th>操作</th>
          </tr></thead>
          <tbody>
            ${list.length ? list.map(n => `
              <tr class="${selected.has(n.id) ? 'selected' : ''}" data-id="${n.id}">
                <td class="col-check"><input type="checkbox" class="rowcheck" data-id="${n.id}" ${selected.has(n.id) ? 'checked' : ''}></td>
                <td>${esc(n.title || '')}</td>
                <td>${(n.tags || []).map(x => `<span class="chip">${esc(x)}</span>`).join(' ')}</td>
                <td>${esc(PBUI.fmtDate(n.updatedAt))}</td>
                <td class="actions"><button class="rowbtn" data-view="${n.id}">查看</button><button class="rowbtn" data-edit="${n.id}">编辑</button><button class="rowbtn danger" data-del="${n.id}">删除</button></td>
              </tr>`).join('') : `<tr><td colspan="5">${PBUI.emptyHint('还没有笔记，点右上角新建')}</td></tr>`}
          </tbody>
        </table>
      </div>`;
    bind();
  }

  function bind() {
    document.getElementById('add').onclick = () => editNote(null);
    document.getElementById('q').oninput = e => { q = e.target.value; render(); };
    document.getElementById('fTag').onchange = e => { fTag = e.target.value; render(); };
    document.querySelectorAll('.sortable').forEach(th => th.onclick = () => { const k = th.dataset.sort; if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; } render(); });
    const checkAll = document.getElementById('checkAll');
    checkAll.onchange = () => { filtered().forEach(n => { if (checkAll.checked) selected.add(n.id); else selected.delete(n.id); }); render(); };
    document.querySelectorAll('.rowcheck').forEach(cb => cb.onchange = () => { const id = cb.dataset.id; if (cb.checked) selected.add(id); else selected.delete(id); render(); });
    document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => viewNote(b.dataset.view));
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editNote(b.dataset.edit));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!confirm('确定删除该笔记？')) return; data().notes = data().notes.filter(n => n.id !== b.dataset.del); save(); render(); });
    const batch = document.getElementById('batch');
    if (batch && selected.size) document.getElementById('b-del').onclick = () => { if (!confirm('确定删除选中的 ' + selected.size + ' 项？')) return; data().notes = data().notes.filter(n => !selected.has(n.id)); selected.clear(); save(); render(); };
  }

  function hl(text, term) {
    const e = esc(text);
    if (!term) return e;
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return e.replace(new RegExp('(' + safe + ')', 'gi'), '<mark>$1</mark>');
  }

  function viewNote(id) {
    const n = data().notes.find(x => x.id === id); if (!n) return;
    const lines = (n.body || '').split('\n');
    const toc = [], bodyHtml = [];
    let inCode = false;
    lines.forEach((ln, i) => {
      if (ln.trim().startsWith('```')) { inCode = !inCode; bodyHtml.push(esc(ln)); return; }
      const m = ln.match(/^(#{1,3})\s+(.*)$/);
      if (m && !inCode) {
        const lvl = m[1].length, tid = 'h' + id + '_' + i;
        toc.push(`<a href="#" data-anchor="${tid}">${esc(m[2])}</a>`);
        bodyHtml.push(`<h${lvl + 1} id="${tid}">${hl(m[2], q)}</h${lvl + 1}>`);
      } else {
        bodyHtml.push(hl(ln, q));
      }
    });
    PBUI.openModal(`
      <h2>${hl(n.title || '', q)}</h2>
      <div class="muted-note">${(n.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join(' ')}</div>
      ${toc.length ? `<div class="toc">${toc.join('')}</div>` : ''}
      <div class="prose">${bodyHtml.join('\n')}</div>
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">关闭</button></div>`);
    document.querySelectorAll('[data-anchor]').forEach(a => a.onclick = e => { e.preventDefault(); const el = document.getElementById(a.dataset.anchor); if (el) el.scrollIntoView({ behavior: 'smooth' }); });
  }

  function editNote(id) {
    const n = id ? data().notes.find(x => x.id === id) : null;
    PBUI.openModal(`
      <h2>${n ? '编辑笔记' : '新建笔记'}</h2>
      <div class="field"><label>标题</label><input type="text" id="n-title" value="${esc(n ? n.title : '')}"></div>
      <div class="field"><label>标签（逗号分隔）</label><input type="text" id="n-tags" value="${esc(n ? (n.tags || []).join(',') : '')}" placeholder="工作,灵感"></div>
      <div class="field"><label>内容（支持 # 标题 生成目录）</label><textarea id="n-body" style="min-height:200px;">${esc(n ? n.body : '')}</textarea></div>
      <div class="modal-foot">
        <button class="btn" onclick="PBUI.closeModal()">取消</button>
        <button class="btn btn-primary" id="n-save">保存</button>
      </div>`);
    document.getElementById('n-save').onclick = () => {
      const title = document.getElementById('n-title').value.trim();
      if (!title) { PBUI.toast('标题不能为空'); return; }
      const tags = document.getElementById('n-tags').value.split(',').map(s => s.trim()).filter(Boolean);
      const body = document.getElementById('n-body').value;
      if (n) { n.title = title; n.tags = tags; n.body = body; PB.touch(n); }
      else { data().notes.push(PB.touch({ id: PB.uid(), title, tags, body })); }
      save(); PBUI.closeModal(); render();
    };
  }

  render();
})();
