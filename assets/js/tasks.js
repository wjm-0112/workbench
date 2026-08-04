const STATUS = {
  todo: { label: '待办', cls: 'status-todo', dot: 'dot-todo' },
  doing: { label: '进行中', cls: 'status-doing', dot: 'dot-doing' },
  done: { label: '完成', cls: 'status-done', dot: 'dot-done' }
};

function renderTasks() {
  const d = PB.getData();
  const q = (document.getElementById('search').value || '').toLowerCase();
  const f = document.getElementById('filter').value;
  let items = d.tasks.filter(t => {
    if (f && t.status !== f) return false;
    if (q && !((t.title || '') + (t.note || '') + (t.tags || []).join(' ')).toLowerCase().includes(q)) return false;
    return true;
  });
  items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const list = document.getElementById('list');
  if (!items.length) { list.innerHTML = PBUI.emptyHint('还没有任务，点右上角“+ 新增”加一条吧～'); return; }
  const today = PBUI.todayStr();
  list.innerHTML = items.map(t => {
    const st = STATUS[t.status] || STATUS.todo;
    const overdue = t.due && t.status !== 'done' && t.due < today;
    return `<div class="item">
      <div class="row">
        <span class="title">${PBUI.esc(t.title)}</span>
        <span class="chip ${st.cls}"><span class="dot ${st.dot}"></span>${st.label}</span>
      </div>
      ${t.due ? `<div class="meta" style="${overdue ? 'color:var(--accent)' : ''}">截止：${PBUI.esc(t.due)} ${overdue ? '(已逾期)' : ''}</div>` : ''}
      ${t.tags && t.tags.length ? `<div class="meta">${t.tags.map(x => `<span class="chip">${PBUI.esc(x)}</span>`).join(' ')}</div>` : ''}
      ${t.note ? `<div class="meta">${PBUI.esc(t.note)}</div>` : ''}
      <div class="actions right">
        <button class="btn btn-sm" data-edit="${t.id}">编辑</button>
        <button class="btn btn-sm btn-accent" data-del="${t.id}">删除</button>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openTask(b.dataset.edit));
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delTask(b.dataset.del));
}

function openTask(id) {
  const d = PB.getData();
  const t = id ? d.tasks.find(x => x.id === id) : null;
  const tpl = `
    <h2>${id ? '编辑任务' : '新增任务'}</h2>
    <div class="field"><label>标题</label><input type="text" id="f-title" value="${PBUI.esc(t ? t.title : '')}"></div>
    <div class="field"><label>备注</label><textarea id="f-note">${PBUI.esc(t ? t.note : '')}</textarea></div>
    <div class="field"><label>截止日期</label><input type="date" id="f-due" value="${t && t.due ? t.due : ''}"></div>
    <div class="field"><label>状态</label><select id="f-status">
      <option value="todo" ${t && t.status === 'todo' ? 'selected' : ''}>待办</option>
      <option value="doing" ${t && t.status === 'doing' ? 'selected' : ''}>进行中</option>
      <option value="done" ${t && t.status === 'done' ? 'selected' : ''}>完成</option>
    </select></div>
    <div class="field"><label>标签（逗号分隔）</label><input type="text" id="f-tags" value="${t && t.tags ? PBUI.esc(t.tags.join(',')) : ''}"></div>
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
      note: document.getElementById('f-note').value,
      due: document.getElementById('f-due').value,
      status: document.getElementById('f-status').value,
      tags: document.getElementById('f-tags').value.split(',').map(s => s.trim()).filter(Boolean)
    };
    if (id) { Object.assign(t, obj); PBUI.touch(t); }
    else { d.tasks.push(PBUI.touch(Object.assign({ id: PB.uid() }, obj))); }
    PB.save(); PBUI.closeModal(); renderTasks(); PBUI.toast('已保存');
  };
}

function delTask(id) {
  if (!confirm('确定删除这条任务？')) return;
  const d = PB.getData();
  d.tasks = d.tasks.filter(x => x.id !== id);
  PB.save(); renderTasks(); PBUI.toast('已删除');
}

window.addEventListener('DOMContentLoaded', async () => {
  PBUI.renderChrome('tasks');
  const ok = await PBUI.ensureUnlocked();
  if (!ok) return;
  await PBUI.afterUnlockSync();
  document.getElementById('add-btn').onclick = () => openTask(null);
  document.getElementById('search').oninput = renderTasks;
  document.getElementById('filter').onchange = renderTasks;
  renderTasks();
});
