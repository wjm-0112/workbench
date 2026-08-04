/* 管理台 · 配置（站点名 / 主题 / 模块显隐 / 财政预设，写回本地加密 config） */
(function () {
  Admin.register('config', {
    title: '配置',
    icon: 'config',
    render(el) {
      const cfg = Admin.config();

      // 财政预设标签编辑器（与 C 端「设置」保持一致）
      function tagBoxHTML(arr, boxId) {
        return arr.map((t) => `<span class="chip">${Admin.esc(t)}<span class="x" data-rm="${Admin.esc(t)}">✕</span></span>`).join('')
          + `<input type="text" data-add placeholder="添加后回车">`;
      }
      function refreshTagBox(boxId, arr) {
        const box = el.querySelector('#' + boxId);
        if (!box) return;
        box.innerHTML = tagBoxHTML(arr, boxId);
        box.querySelectorAll('[data-rm]').forEach((x) => (x.onclick = () => {
          const v = x.dataset.rm; const i = arr.indexOf(v);
          if (i >= 0) { arr.splice(i, 1); PB.setConfig(cfg); refreshTagBox(boxId, arr); }
        }));
        const add = box.querySelector('[data-add]');
        if (add) add.onkeydown = (e) => {
          if (e.key === 'Enter') {
            const v = add.value.trim();
            if (v && !arr.includes(v)) { arr.push(v); PB.setConfig(cfg); refreshTagBox(boxId, arr); }
          }
        };
      }

      el.innerHTML = `
        <div class="card">
          <div class="panel-head"><h2>基础</h2></div>
          <div class="field"><label>站点名称</label><input class="input" id="siteName" value="${Admin.esc(cfg.siteName || '')}"></div>
          <div class="field"><label>明暗模式</label>
            <label class="radio"><input type="radio" name="mode" value="light" ${(cfg.theme.mode || 'light') !== 'dark' ? 'checked' : ''}> 浅色</label>
            <label class="radio"><input type="radio" name="mode" value="dark" ${cfg.theme.mode === 'dark' ? 'checked' : ''}> 深色</label>
          </div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="panel-head"><h2>模块显隐</h2></div>
          <div id="mods"></div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="panel-head"><h2>默认预设 · 财政</h2></div>
          <div class="field"><label>财政分类</label><div class="tag-edit" id="tags-fin">${tagBoxHTML(cfg.defaults.financeCategories || [], 'tags-fin')}</div></div>
          <div class="field"><label>财政账户</label><div class="tag-edit" id="tags-acc">${tagBoxHTML(cfg.defaults.financeAccounts || [], 'tags-acc')}</div></div>
          <p class="muted">其余预设（任务标签 / 习惯项 / 存储方式）与配色、模块改名/排序，请在 C 端「设置」页调整。</p>
        </div>`;

      const mods = el.querySelector('#mods');
      mods.innerHTML = (cfg.modules || []).map((m) => `
        <label class="check"><input type="checkbox" data-key="${Admin.esc(m.key)}" ${m.enabled !== false ? 'checked' : ''}> ${Admin.esc(m.label)} <span class="muted">(${Admin.esc(m.key)})</span></label>`).join('');

      el.querySelector('#siteName').oninput = (e) => { cfg.siteName = e.target.value; PB.setConfig(cfg); };
      el.querySelectorAll('input[name=mode]').forEach((r) => (r.onchange = () => {
        cfg.theme.mode = document.querySelector('input[name=mode]:checked').value;
        Admin.applyTheme(cfg.theme.mode);
        PB.setConfig(cfg);
      }));
      mods.querySelectorAll('input[type=checkbox]').forEach((cb) => (cb.onchange = () => {
        const m = (cfg.modules || []).find((x) => x.key === cb.dataset.key);
        if (m) { m.enabled = cb.checked; PB.setConfig(cfg); }
      }));

      refreshTagBox('tags-fin', cfg.defaults.financeCategories || (cfg.defaults.financeCategories = []));
      refreshTagBox('tags-acc', cfg.defaults.financeAccounts || (cfg.defaults.financeAccounts = []));
    },
  });
})();
