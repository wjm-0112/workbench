function renderNotes() {
  const d = PB.getData();
  const q = (document.getElementById('search').value || '').toLowerCase();
  let items = d.notes.filter(n => {
    if (q && !((n.title || '') + (n.body || '') + (n.tags || []).join(' ')).toLowerCase().includes(q)) return false;
    return true;
  });
  items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const list = document.getElementById('list');
  if (!items.length) { list.innerHTML = PBUI.emptyHint('还没有笔记，写点什么吧～'); return; }
  list.innerHTML = items.map(n => `
    <div class="item">
      <div class="row"><span class="title">${PBUI.esc(n.title)}</span><span class="meta">${PBUI.fmtDate(n.updatedAt)}</span></div>
      <div class="meta">${PBUI.esc((n.body || '').slice(0, 60))}${(n.body || '').length > 60 ? '…' : ''}</div>
      ${n.tags && n.tags.length ? `<div class="meta">${n.tags.map(x => `<span class="chip">${PBUI.esc(x)}</span>`).join(' ')}</div>` : ''}
      ${n.links && n.links.length ? `<div class="link-list">${n.links.map(l => `<a href="${PBUI.esc(l)}" target="_blank" rel="noopener">${PBUI.esc(l)}</a>`).join('')}</div>` : ''}
      <div class="actions right">
        <button class="btn btn-sm" data-edit="${n.id}">编辑</button>
        <button class="btn btn-sm btn-accent" data-del="${n.id}">删除</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openNote(b.dataset.edit));
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delNote(b.dataset.del));
}

function openNote(id) {
  const d = PB.getData();
  const n = id ? d.notes.find(x => x.id === id) : null;
  const tpl = `
    <h2>${id ? '编辑笔记' : '新增笔记'}</h2>
    <div class="field"><label>标题</label><input type="text" id="f-title" value="${PBUI.esc(n ? n.title : '')}"></div>
    <div class="field"><label>标签（逗号分隔）</label><input type="text" id="f-tags" value="${n && n.tags ? PBUI.esc(n.tags.join(',')) : ''}"></div>
    <div class="field"><label>网页链接（逗号分隔，可选）</label><input type="text" id="f-links" value="${n && n.links ? PBUI.esc(n.links.join(',')) : ''}"></div>
    <div class="field"><label>内容（支持 Markdown）</label><textarea id="f-body" style="min-height:160px">${PBUI.esc(n ? n.body : '')}</textarea></div>
    <div class="field"><label>预览</label><div class="card" id="preview" style="margin:0"></div></div>
    <div class="toolbar">
      <button class="btn btn-primary" id="save">保存</button>
      <button class="btn btn-ghost" id="cancel">取消</button>
    </div>`;
  PBUI.openModal(tpl);
  const body = document.getElementById('f-body');
  const prev = document.getElementById('preview');
  const update = () => {
    const txt = body.value || '*什么都没写~*';
    prev.innerHTML = (window.marked ? marked.parse(txt) : PBUI.esc(txt));
  };
  body.oninput = update; update();
  document.getElementById('cancel').onclick = PBUI.closeModal;
  document.getElementById('save').onclick = () => {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { PBUI.toast('标题不能为空'); return; }
    const obj = {
      title,
      body: body.value,
      tags: document.getElementById('f-tags').value.split(',').map(s => s.trim()).filter(Boolean),
      links: document.getElementById('f-links').value.split(',').map(s => s.trim()).filter(Boolean)
    };
    if (id) { Object.assign(n, obj); PBUI.touch(n); }
    else { d.notes.push(PBUI.touch(Object.assign({ id: PB.uid() }, obj))); }
    PB.save(); PBUI.closeModal(); renderNotes(); PBUI.toast('已保存');
  };
}

function delNote(id) {
  if (!confirm('确定删除这条笔记？')) return;
  const d = PB.getData();
  d.notes = d.notes.filter(x => x.id !== id);
  PB.save(); renderNotes(); PBUI.toast('已删除');
}

window.addEventListener('DOMContentLoaded', async () => {
  PBUI.renderChrome('notes');
  const ok = await PBUI.ensureUnlocked();
  if (!ok) return;
  await PBUI.afterUnlockSync();
  document.getElementById('add-btn').onclick = () => openNote(null);
  document.getElementById('search').oninput = renderNotes;
  renderNotes();
});
