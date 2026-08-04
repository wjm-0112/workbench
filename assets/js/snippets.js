function renderSnips() {
  const d = PB.getData();
  const q = (document.getElementById('search').value || '').toLowerCase();
  let items = d.snippets.filter(s => {
    if (q && !((s.title || '') + (s.code || '') + (s.lang || '') + (s.desc || '')).toLowerCase().includes(q)) return false;
    return true;
  });
  items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const list = document.getElementById('list');
  if (!items.length) { list.innerHTML = PBUI.emptyHint('还没有速查条目，存一段代码或命令吧～'); return; }
  list.innerHTML = items.map(s => `
    <div class="item">
      <div class="row"><span class="title">${PBUI.esc(s.title)}</span><span class="chip">${PBUI.esc(s.lang || '代码')}</span></div>
      ${s.desc ? `<div class="meta">${PBUI.esc(s.desc)}</div>` : ''}
      <pre class="code">${PBUI.esc(s.code)}</pre>
      <div class="actions right">
        <button class="btn btn-sm" data-copy="${s.id}">复制</button>
        <button class="btn btn-sm" data-edit="${s.id}">编辑</button>
        <button class="btn btn-sm btn-accent" data-del="${s.id}">删除</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copySnip(b.dataset.copy));
  list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openSnip(b.dataset.edit));
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delSnip(b.dataset.del));
}

function copySnip(id) {
  const s = PB.getData().snippets.find(x => x.id === id);
  if (!s) return;
  navigator.clipboard.writeText(s.code).then(() => PBUI.toast('已复制')).catch(() => PBUI.toast('复制失败，请手动选择'));
}

function openSnip(id) {
  const d = PB.getData();
  const s = id ? d.snippets.find(x => x.id === id) : null;
  const tpl = `
    <h2>${id ? '编辑条目' : '新增速查'}</h2>
    <div class="field"><label>标题</label><input type="text" id="f-title" value="${PBUI.esc(s ? s.title : '')}"></div>
    <div class="field"><label>类型 / 语言</label><input type="text" id="f-lang" value="${PBUI.esc(s ? s.lang : '')}" placeholder="如：JavaScript / API / 命令"></div>
    <div class="field"><label>说明（可选）</label><input type="text" id="f-desc" value="${PBUI.esc(s ? s.desc : '')}"></div>
    <div class="field"><label>代码 / 内容</label><textarea id="f-code" style="min-height:140px;font-family:ui-monospace,monospace">${PBUI.esc(s ? s.code : '')}</textarea></div>
    <div class="toolbar">
      <button class="btn btn-primary" id="save">保存</button>
      <button class="btn btn-ghost" id="cancel">取消</button>
    </div>`;
  PBUI.openModal(tpl);
  document.getElementById('cancel').onclick = PBUI.closeModal;
  document.getElementById('save').onclick = () => {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { PBUI.toast('标题不能为空'); return; }
    const obj = {
      title,
      lang: document.getElementById('f-lang').value.trim(),
      desc: document.getElementById('f-desc').value.trim(),
      code: document.getElementById('f-code').value
    };
    if (id) { Object.assign(s, obj); PBUI.touch(s); }
    else { d.snippets.push(PBUI.touch(Object.assign({ id: PB.uid() }, obj))); }
    PB.save(); PBUI.closeModal(); renderSnips(); PBUI.toast('已保存');
  };
}

function delSnip(id) {
  if (!confirm('确定删除这条速查？')) return;
  const d = PB.getData();
  d.snippets = d.snippets.filter(x => x.id !== id);
  PB.save(); renderSnips(); PBUI.toast('已删除');
}

window.addEventListener('DOMContentLoaded', async () => {
  PBUI.renderChrome('snippets');
  const ok = await PBUI.ensureUnlocked();
  if (!ok) return;
  await PBUI.afterUnlockSync();
  document.getElementById('add-btn').onclick = () => openSnip(null);
  document.getElementById('search').oninput = renderSnips;
  renderSnips();
});
