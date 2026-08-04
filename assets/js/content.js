/* ===== 内容消费（C 端）：浏览 / 搜索 / 分类 / 收藏 已发布内容 =====
   公开模块，不强制本地解锁（用默认配置渲染外壳）；收藏记录存 localStorage。
   数据来自后端 /api/contents 公共接口（仅 published 内容）。 */
(async function () {
  const esc = PBUI.esc;
  const cfg = PB.getConfig();
  PBUI.applyTheme(cfg.theme);
  PBUI.renderChrome('content');

  const FAV_KEY = 'pwb_fav_content';
  const fav = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; } };
  const setFav = (a) => localStorage.setItem(FAV_KEY, JSON.stringify(a));
  const isFav = (id) => fav().includes(id);
  function toggleFav(id) { const a = fav(); const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id); setFav(a); }

  let q = '', cat = '', page = 1, pageSize = 10, total = 0;
  let categories = [];
  let loading = false;

  function sanitize(html) {
    return (html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }
  function renderMarkdown(body) {
    const raw = body || '';
    if (typeof marked === 'undefined') {
      return esc(raw).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
    }
    try { return sanitize(marked.parse(raw, { breaks: true })); } catch (e) { return esc(raw).replace(/\n/g, '<br>'); }
  }

  async function loadCats() {
    try {
      const res = await fetch('/api/contents/categories');
      const j = await res.json();
      categories = (j.categories || []);
    } catch (e) { categories = []; }
  }

  async function load(append) {
    if (loading) return;
    loading = true;
    const params = new URLSearchParams({ page, pageSize });
    if (q) params.set('q', q);
    if (cat) params.set('category', cat);
    try {
      const res = await fetch('/api/contents?' + params.toString());
      const j = await res.json();
      total = j.total || 0;
      const items = j.items || [];
      if (append) appendItems(items); else renderShell(items);
    } catch (e) {
      if (!append) document.getElementById('content').innerHTML = PBUI.emptyHint('内容加载失败，请确认后端已启动');
    } finally { loading = false; }
  }

  function catChips() {
    const all = ['<button class="chip ' + (cat === '' ? 'active' : '') + '" data-cat="">全部</button>']
      .concat(categories.map(c => `<button class="chip ${cat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`));
    return all.join('');
  }

  function cardHTML(c) {
    const on = isFav(c.id);
    return `
      <article class="content-card" data-id="${esc(c.id)}">
        <div class="cc-head">
          <span class="cc-cat">${esc(c.category || '未分类')}</span>
          <button class="fav-btn ${on ? 'on' : ''}" data-fav="${esc(c.id)}" title="收藏">${on ? '★' : '☆'}</button>
        </div>
        <h3 class="cc-title">${esc(c.title || '无标题')}</h3>
        <p class="cc-summary">${esc(c.summary || '')}</p>
        <div class="cc-foot">
          <span class="cc-tags">${(c.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join(' ')}</span>
          <span class="muted-note">${esc(PBUI.fmtDate(c.publishedAt || c.updatedAt))}</span>
        </div>
      </article>`;
  }

  function renderShell(items) {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>内容</h1><span class="muted-note">共 ${total} 篇</span></div>
      <div class="toolbar">
        <input type="search" id="q" placeholder="搜索标题/正文/标签" value="${esc(q)}">
      </div>
      <div class="cat-row" id="cats">${catChips()}</div>
      <div class="content-list" id="list">${items.length ? items.map(cardHTML).join('') : PBUI.emptyHint('还没有内容')}</div>
      <div id="more-wrap">${moreBtn()}</div>`;
    bindShell();
    const qEl = document.getElementById('q');
    qEl.oninput = debounce(() => { q = qEl.value.trim(); page = 1; load(false); }, 350);
  }

  function appendItems(items) {
    const list = document.getElementById('list');
    if (!list) return;
    const old = (list.innerHTML.match(/data-id=/g) || []).length;
    if (old === 0) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', items.map(cardHTML).join(''));
    bindCards();
    const more = document.getElementById('more-wrap');
    if (more) more.innerHTML = moreBtn();
    bindMore();
  }

  function moreBtn() {
    const shown = (document.querySelectorAll('#list .content-card') || []).length;
    return (total > shown)
      ? `<button class="btn btn-block mt" id="more">加载更多（${shown}/${total}）</button>`
      : '';
  }

  function bindShell() {
    document.getElementById('cats').querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
      cat = b.dataset.cat; page = 1; load(false);
    });
    bindCards();
    bindMore();
  }
  function bindCards() {
    document.querySelectorAll('#list .content-card').forEach(el => {
      el.onclick = (e) => {
        if (e.target.closest('[data-fav]')) return;
        openDetail(el.dataset.id);
      };
    });
    document.querySelectorAll('#list [data-fav]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      toggleFav(b.dataset.fav);
      const on = isFav(b.dataset.fav);
      b.classList.toggle('on', on); b.textContent = on ? '★' : '☆';
    });
  }
  function bindMore() {
    const m = document.getElementById('more');
    if (m) m.onclick = () => { page += 1; load(true); };
  }

  async function openDetail(id) {
    try {
      const res = await fetch('/api/contents/' + encodeURIComponent(id));
      if (!res.ok) { PBUI.toast('内容加载失败'); return; }
      const j = await res.json();
      const c = j.content;
      const on = isFav(c.id);
      PBUI.openModal(`
        <div class="cc-head" style="margin-bottom:6px;">
          <span class="cc-cat">${esc(c.category || '未分类')}</span>
          <button class="fav-btn ${on ? 'on' : ''}" id="d-fav" data-fav="${esc(c.id)}">${on ? '★ 已收藏' : '☆ 收藏'}</button>
        </div>
        <h2>${esc(c.title || '')}</h2>
        <div class="muted-note" style="margin-bottom:10px;">${(c.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join(' ')} · ${esc(PBUI.fmtDate(c.publishedAt || c.updatedAt))}</div>
        <div class="prose">${renderMarkdown(c.body)}</div>
        <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">关闭</button></div>`);
      const fb = document.getElementById('d-fav');
      if (fb) fb.onclick = () => {
        toggleFav(c.id);
        const now = isFav(c.id);
        fb.classList.toggle('on', now); fb.textContent = now ? '★ 已收藏' : '☆ 收藏';
        const cardFav = document.querySelector(`#list [data-fav="${CSS.escape(c.id)}"]`);
        if (cardFav) { cardFav.classList.toggle('on', now); cardFav.textContent = now ? '★' : '☆'; }
      };
    } catch (e) { PBUI.toast('内容加载失败'); }
  }

  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  await loadCats();
  await load(false);
})();
