/* B 端后台 · 内容 / 业务数据管理（先行） */
(function () {
  Admin.register('content', {
    title: '内容管理',
    icon: '📝',
    async render(el) {
      const s = await Admin.api('/admin/contents');
      const items = s.items || [];
      el.innerHTML = `
        <div class="toolbar">
          <button class="btn primary" id="add">＋ 新建内容</button>
          <input class="input" id="q" placeholder="搜索标题…" style="max-width:240px">
          <div class="spacer"></div>
          <span class="muted">共 ${items.length} 条</span>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>标题</th><th>分类</th><th>状态</th><th>更新时间</th><th>操作</th></tr></thead>
          <tbody>${items.length ? items.map(row).join('') : `<tr><td colspan="5" class="empty">暂无内容</td></tr>`}</tbody>
        </table></div>`;
      el.querySelector('#add').onclick = () => edit(el, null);
      const q = el.querySelector('#q');
      q.oninput = () => {
        const k = q.value.trim().toLowerCase();
        el.querySelectorAll('tbody tr').forEach((tr) => {
          if (!tr.dataset.title) return;
          tr.style.display = tr.dataset.title.toLowerCase().includes(k) ? '' : 'none';
        });
      };
      el.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => edit(el, items.find((x) => x.id === b.dataset.edit))));
      el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
        if (!confirm('确定删除该内容？')) return;
        await Admin.api('/admin/contents/' + b.dataset.del, { method: 'DELETE' });
        Admin.toast('已删除', 'ok');
        Admin.register('__r', {}); // noop
        content.render(el);
      }));
    },
  });

  function row(c) {
    const st = c.status === 'published' ? '<span class="badge ok">已发布</span>' : '<span class="badge mut">草稿</span>';
    return `<tr data-title="${Admin.esc(c.title)}">
      <td>${Admin.esc(c.title)}</td>
      <td>${Admin.esc(c.category || '-')}</td>
      <td>${st}</td>
      <td class="muted">${Admin.fmtDate(c.updatedAt)}</td>
      <td><button class="btn sm" data-edit="${c.id}">编辑</button> <button class="btn sm danger" data-del="${c.id}">删除</button></td>
    </tr>`;
  }

  function edit(el, c) {
    const isEdit = !!c;
    const body = `
      <div class="field"><label>标题</label><input class="input" id="f_title" value="${Admin.esc(c ? c.title : '')}"></div>
      <div class="row">
        <div class="field"><label>分类</label><input class="input" id="f_cat" value="${Admin.esc(c ? c.category : '')}" placeholder="如：公告"></div>
        <div class="field"><label>状态</label><select id="f_status"><option value="draft" ${c && c.status === 'draft' ? 'selected' : ''}>草稿</option><option value="published" ${!c || c.status === 'published' ? 'selected' : ''}>发布</option></select></div>
      </div>
      <div class="field"><label>摘要</label><input class="input" id="f_summary" value="${Admin.esc(c ? c.summary : '')}"></div>
      <div class="field"><label>标签（逗号分隔）</label><input class="input" id="f_tags" value="${Admin.esc(c ? (c.tags || []).join(',') : '')}"></div>
      <div class="field"><label>正文</label><textarea class="input" id="f_body" rows="6">${Admin.esc(c ? c.body : '')}</textarea></div>`;
    Admin.modal(isEdit ? '编辑内容' : '新建内容', body, async (mask) => {
      const payload = {
        title: mask.querySelector('#f_title').value.trim(),
        category: mask.querySelector('#f_cat').value.trim() || '未分类',
        status: mask.querySelector('#f_status').value,
        summary: mask.querySelector('#f_summary').value.trim(),
        tags: mask.querySelector('#f_tags').value.split(',').map((t) => t.trim()).filter(Boolean),
        body: mask.querySelector('#f_body').value,
      };
      if (!payload.title) { Admin.toast('标题必填', 'err'); return false; }
      if (isEdit) await Admin.api('/admin/contents/' + c.id, { method: 'PUT', body: payload });
      else await Admin.api('/admin/contents', { method: 'POST', body: payload });
      Admin.toast('已保存', 'ok');
      content.render(el);
    });
  }

  const content = Admin.sections.content;
})();
