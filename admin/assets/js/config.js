/* 管理台 · 配置（站点名 / 主题 / 模块显隐，写回本地加密 config） */
(function () {
  Admin.register('config', {
    title: '配置',
    icon: '⚙️',
    render(el) {
      const cfg = Admin.config();
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
          <p class="muted">配色、模块改名/排序、默认预设等更细配置，请在 C 端「我的」页调整。</p>
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
    },
  });
})();
