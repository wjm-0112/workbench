/* ===== 知识库（结构化卡片 + 分类/标签/搜索 + 详情） ===== */
(async function () {
  const esc = PBUI.esc;
  const save = () => PB.save();

  if (!await PBUI.ensureUnlocked()) return;
  const mods = PB.getConfig().modules.filter(m => m.enabled !== false);
  if (!mods.find(m => m.key === 'snippets')) { location.href = (mods[0] && (mods[0].key === 'dashboard' ? 'index.html' : mods[0].key + '.html')) || 'index.html'; return; }
  PBUI.applyTheme(PB.getConfig().theme);
  PBUI.renderChrome('snippets');
  await PBUI.afterUnlockSync();

  const data = () => PB.getData();
  let q = '', fCat = '', fTag = '';
  const norm = s => { s.summary = s.summary || ''; s.category = s.category || '通用'; s.tags = s.tags || []; s.attachments = s.attachments || []; return s; };

  function catOptions() { return PB.getConfig().defaults.kbCategories || ['通用']; }
  function allTags() { const s = new Set(); data().snippets.forEach(x => (x.tags || []).forEach(t => s.add(t))); return Array.from(s); }

  function filtered() {
    let list = data().snippets.map(norm);
    if (q) { const low = q.toLowerCase(); list = list.filter(s => (s.title || '').toLowerCase().includes(low) || (s.summary || '').toLowerCase().includes(low) || (s.body || '').toLowerCase().includes(low)); }
    if (fCat) list = list.filter(s => s.category === fCat);
    if (fTag) list = list.filter(s => (s.tags || []).includes(fTag));
    return list;
  }

  function render() {
    const list = filtered();
    const cats = catOptions();
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>知识库</h1><button class="btn btn-primary" id="add">+ 新建条目</button></div>
      <div class="toolbar">
        <input type="search" id="q" placeholder="搜索标题/摘要/正文" value="${esc(q)}">
        <select id="fCat"><option value="">全部分类</option>${cats.map(c => `<option value="${esc(c)}" ${fCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <select id="fTag"><option value="">全部标签</option>${allTags().map(t => `<option value="${esc(t)}" ${fTag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </div>
      <div class="kb-grid">
        ${list.length ? list.map(s => `
          <div class="kb-card" data-id="${s.id}">
            <div class="kb-title">${esc(s.title || '')}</div>
            <div class="kb-summary">${esc(s.summary || (s.body || '').slice(0, 80))}</div>
            <div class="kb-foot">
              <span class="kb-cat">${esc(s.category)}</span>
              ${(s.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}
              ${(s.attachments || []).length ? `<span class="chip att">📎 ${s.attachments.length}</span>` : ''}
            </div>
          </div>`).join('') : PBUI.emptyHint('知识库还是空的，点右上角新建一条')}
      </div>`;
    bind();
  }

  function bind() {
    document.getElementById('add').onclick = () => editItem(null);
    document.getElementById('q').oninput = e => { q = e.target.value; render(); };
    document.getElementById('fCat').onchange = e => { fCat = e.target.value; render(); };
    document.getElementById('fTag').onchange = e => { fTag = e.target.value; render(); };
    document.querySelectorAll('.kb-card').forEach(c => c.onclick = () => viewItem(c.dataset.id));
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); PBUI.toast('已复制'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); PBUI.toast('已复制'); } catch (e2) { PBUI.toast('复制失败，请手动选择'); }
      document.body.removeChild(ta);
    }
  }

  function attachmentsHTML(s) {
    const atts = s.attachments || [];
    if (!atts.length) return '';
    return `<div class="att-block"><h4>附件（${atts.length}）</h4>${atts.map(a => {
      if ((a.type || '').startsWith('image/')) {
        return `<div class="att-item"><img src="${esc(a.data)}" alt="${esc(a.name)}"><div class="muted-note">${esc(a.name)}</div></div>`;
      }
      return `<div class="att-item"><a href="${esc(a.data)}" download="${esc(a.name)}" class="btn btn-sm">⬇️ 下载 ${esc(a.name)}</a></div>`;
    }).join('')}</div>`;
  }

  function viewItem(id) {
    const s = data().snippets.find(x => x.id === id); if (!s) return;
    s.attachments = s.attachments || [];
    PBUI.openModal(`
      <h2>${esc(s.title || '')}</h2>
      <div class="muted-note">分类：<b>${esc(s.category)}</b> · ${(s.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join(' ')}</div>
      <div class="prose mt">${esc(s.body || '').replace(/</g, '&lt;')}</div>
      ${attachmentsHTML(s)}
      <div class="modal-foot">
        <button class="btn" id="copy">复制内容</button>
        <button class="btn" id="edit">编辑</button>
        <button class="btn btn-accent" id="del">删除</button>
        <button class="btn" onclick="PBUI.closeModal()">关闭</button>
      </div>`);
    document.getElementById('copy').onclick = () => copyText(s.body || '');
    document.getElementById('edit').onclick = () => editItem(id);
    document.getElementById('del').onclick = () => {
      if (!confirm('确定删除该条目？此操作不可撤销')) return;
      data().snippets = data().snippets.filter(x => x.id !== id);
      save(); PBUI.closeModal(); render();
    };
  }

  function editItem(id) {
    const s = id ? data().snippets.find(x => x.id === id) : null;
    const cats = catOptions();
    let atts = (s && s.attachments) ? s.attachments.map(a => Object.assign({}, a)) : [];

    function attArea() {
      return `<div class="att-head">附件（图片 / 文件，内联保存）<span class="muted-note">${atts.length} 个</span></div>
        <input type="file" id="s-file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.zip">
        <div class="att-list">${atts.map((a, i) => `<div class="att-row"><span class="att-name">${esc(a.name)}</span><span class="muted-note">${esc(a.type || '')}</span><button class="btn btn-sm btn-accent" data-rm-att="${i}">移除</button></div>`).join('')}</div>`;
    }
    function refreshAtt() {
      const wrap = document.getElementById('att-wrap'); if (!wrap) return;
      wrap.innerHTML = attArea();
      const fi = document.getElementById('s-file');
      if (fi) fi.onchange = handleFiles;
      wrap.querySelectorAll('[data-rm-att]').forEach(b => b.onclick = () => { atts.splice(Number(b.dataset.rmAtt), 1); refreshAtt(); });
    }
    function handleFiles() {
      const files = Array.from(this.files || []);
      if (!files.length) return;
      let pending = files.length;
      const done = () => { if (--pending === 0) refreshAtt(); };
      files.forEach(f => {
        const r = new FileReader();
        r.onload = () => { atts.push({ name: f.name, type: f.type || 'application/octet-stream', data: r.result }); done(); };
        r.onerror = done;
        r.readAsDataURL(f);
      });
    }

    PBUI.openModal(`
      <h2>${s ? '编辑条目' : '新建条目'}</h2>
      <div class="field"><label>标题</label><input type="text" id="s-title" value="${esc(s ? s.title : '')}"></div>
      <div class="field"><label>摘要（列表展示）</label><input type="text" id="s-summary" value="${esc(s ? s.summary : '')}" placeholder="一句话说明"></div>
      <div class="field"><label>分类</label><input type="text" id="s-cat" list="kbCats" value="${esc(s ? s.category : cats[0] || '通用')}" placeholder="输入或选择">
        <datalist id="kbCats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field"><label>标签（逗号分隔）</label><input type="text" id="s-tags" value="${esc(s ? (s.tags || []).join(',') : '')}" placeholder="前端,API"></div>
      <div class="field"><label>正文</label><textarea id="s-body" style="min-height:180px;">${esc(s ? s.body : '')}</textarea></div>
      <div class="att-edit" id="att-wrap">${attArea()}</div>
      <div class="modal-foot">
        <button class="btn" onclick="PBUI.closeModal()">取消</button>
        <button class="btn btn-primary" id="s-save">保存</button>
      </div>`);
    const fi = document.getElementById('s-file'); if (fi) fi.onchange = handleFiles;
    document.querySelectorAll('#att-wrap [data-rm-att]').forEach(b => b.onclick = () => { atts.splice(Number(b.dataset.rmAtt), 1); refreshAtt(); });
    document.getElementById('s-save').onclick = () => {
      const title = document.getElementById('s-title').value.trim();
      if (!title) { PBUI.toast('标题不能为空'); return; }
      const category = document.getElementById('s-cat').value.trim() || '通用';
      const tags = document.getElementById('s-tags').value.split(',').map(x => x.trim()).filter(Boolean);
      const summary = document.getElementById('s-summary').value.trim();
      const body = document.getElementById('s-body').value;
      if (s) { s.title = title; s.summary = summary; s.category = category; s.tags = tags; s.body = body; s.attachments = atts; PB.touch(s); }
      else { data().snippets.push(PB.touch({ id: PB.uid(), title, summary, category, tags, body, attachments: atts })); }
      save(); PBUI.closeModal(); render();
    };
  }

  render();
})();
