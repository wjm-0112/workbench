/* ===== 我的（个人中心 + 全部配置） ===== */
(async function () {
  const esc = PBUI.esc;
  const save = () => PB.save();
  const cfg = () => PB.getConfig();

  if (!await PBUI.ensureUnlocked()) return;
  PBUI.applyTheme(cfg().theme);
  PBUI.renderChrome('profile');
  await PBUI.afterUnlockSync();

  const COLOR_KEYS = [
    ['primary', '主色'], ['accent', '强调色'], ['bg', '页面底色'], ['surface', '卡片底色'],
    ['ink', '文字色'], ['muted', '辅助文字'], ['success', '成功'], ['warn', '警告'],
    ['purple', '辅助色'], ['border', '边框色']
  ];
  const CARD_LABELS = { pending: '待办任务', dueToday: '今日到期', overdue: '已逾期', habitStreak: '习惯连续天数' };

  function colorRows(mode) {
    const pal = cfg().theme[mode];
    return COLOR_KEYS.map(([k, name]) => `
      <div class="color-row">
        <span class="sw-name">${name}</span>
        <input type="color" data-mode="${mode}" data-key="${k}" value="${pal[k]}">
        <input type="text" data-hex="${mode}" data-key="${k}" value="${pal[k]}">
      </div>`).join('');
  }

  function tagsHTML(arr) {
    return `<div class="tag-edit" data-tags>${arr.map(t =>
      `<span class="chip">${esc(t)}<span class="x" data-rm="${esc(t)}">✕</span></span>`).join('')}
      <input type="text" data-add placeholder="添加后回车"></div>`;
  }

  function modulesHTML() {
    const ms = cfg().modules.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    return ms.map((m, i) => `
      <div class="mod-row" data-key="${esc(m.key)}">
        <input type="checkbox" data-enable ${m.enabled !== false ? 'checked' : ''}>
        <input type="text" value="${esc(m.label)}" data-label style="width:120px;">
        <span class="m-type">${m.type === 'link' ? '外链' : m.type === 'custom' ? '内部入口' : '内置'}${m.core ? ' · 核心' : ''}</span>
        <span class="spacer"></span>
        <button class="btn btn-sm" data-up ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-sm" data-down ${i === ms.length - 1 ? 'disabled' : ''}>↓</button>
        ${m.core ? '' : '<button class="btn btn-sm btn-accent" data-del>删除</button>'}
      </div>`).join('');
  }

  function cloudAreaHTML() {
    const token = PB.getCloudToken();
    const cloudUser = localStorage.getItem('pwb_cloud_user') || '';
    const enabled = !!(cfg().cloud && cfg().cloud.enabled);
    if (token) {
      const lastSync = (PB.getData().meta && PB.getData().meta.lastSyncAt) ? new Date(PB.getData().meta.lastSyncAt).toLocaleString('zh-CN') : '尚未同步';
      return `
        <div class="cfg-row"><label>已登录账号</label><b>${esc(cloudUser)}</b></div>
        <div class="cfg-row"><label>启用云同步</label><input type="checkbox" id="cloud-en" ${enabled ? 'checked' : ''}></div>
        <div class="cfg-row">
          <button class="btn btn-primary" id="btn-push">立即同步（上传）</button>
          <button class="btn" id="btn-pull">拉取同步</button>
          <button class="btn btn-accent" id="btn-logout">退出账号</button>
        </div>
        <div class="muted-note">最近同步：${esc(lastSync)}</div>`;
    }
    return `
      <div class="cfg-row"><label>账号</label><input type="text" id="cl-user" placeholder="用户名" style="max-width:220px;"></div>
      <div class="cfg-row"><label>密码</label><input type="password" id="cl-pass" placeholder="密码" style="max-width:220px;"></div>
      <div class="cfg-row">
        <button class="btn btn-primary" id="btn-login">登录并开启同步</button>
        <button class="btn" id="btn-reg">注册新账号</button>
      </div>`;
  }

  function render() {
    const c = cfg();
    const lastSync = c.meta && c.meta.lastSyncAt ? new Date(c.meta.lastSyncAt).toLocaleString('zh-CN') : '尚未同步';
    const cloudOn = !!(c.cloud && c.cloud.enabled);
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>我的</h1><span class="muted-note">所有改动即时生效并自动保存</span></div>

      <div class="cfg-section">
        <h3>个人中心</h3>
        <div class="profile-head">
          <div class="avatar" id="avatar">${esc((c.profile.userName || '我').slice(0, 1))}</div>
          <div class="meta">
            <div class="name"><input type="text" id="userName" value="${esc(c.profile.userName || '我')}" style="width:160px;"></div>
            <div class="role"><input type="text" id="userRole" value="${esc(c.profile.role || '会员')}" style="width:160px;"></div>
          </div>
          <span class="spacer" style="margin-left:auto;"></span>
        </div>
        <div class="muted-note">云同步状态：${cloudOn ? '已开启' : '未开启'} · 最近同步：${esc(lastSync)}</div>
      </div>

      <div class="cfg-section">
        <h3>快捷入口</h3>
        <p class="hint">底部 Tab 默认展示看板 / 内容 / 任务 / 笔记 / 我的 共 5 项，以下模块同样可用。</p>
        <div class="quick-grid">
          <a class="quick-card" href="snippets.html"><span class="qc-ico">📚</span><span class="qc-label">知识库</span></a>
          <a class="quick-card" href="orders.html"><span class="qc-ico">🛒</span><span class="qc-label">商城</span></a>
          <a class="quick-card" href="content.html"><span class="qc-ico">📰</span><span class="qc-label">内容</span></a>
        </div>
      </div>

      <div class="cfg-section">
        <h3>访问控制</h3>
        <div class="cfg-row">
          <button class="btn" id="btn-pw">修改密码</button>
          <button class="btn btn-accent" id="btn-lock">锁定并退出</button>
        </div>
      </div>

      <div class="cfg-section">
        <h3>云端同步（账号）</h3>
        <p class="hint">登录账号后，加密数据可跨设备同步（服务端只见密文，密码不离开浏览器）。不登录也能正常使用本地版。</p>
        <div id="cloud-area">${cloudAreaHTML()}</div>
      </div>

      <div class="cfg-section">
        <h3>数据备份</h3>
        <div class="cfg-row">
          <button class="btn" id="btn-export">导出备份（JSON）</button>
          <button class="btn" id="btn-import">导入备份</button>
          <input type="file" id="import-file" accept="application/json,.json" class="hidden">
        </div>
        <p class="hint">导出文件为明文，请自行妥善保管；导入会覆盖当前数据并立即同步配置。</p>
      </div>

      <div class="cfg-section">
        <h3>站点与主题</h3>
        <div class="cfg-row"><label>站点名称</label><input type="text" id="siteName" value="${esc(c.siteName || '我的工作台')}" style="max-width:240px;"></div>
        <div class="cfg-row"><label>明暗模式</label>
          <label><input type="radio" name="mode" value="light" ${c.theme.mode !== 'dark' ? 'checked' : ''}> 浅色</label>
          <label style="margin-left:12px;"><input type="radio" name="mode" value="dark" ${c.theme.mode === 'dark' ? 'checked' : ''}> 深色</label>
        </div>
        <div class="grid-2">
          <div><h3 style="font-size:15px;">浅色配色</h3>${colorRows('light')}</div>
          <div><h3 style="font-size:15px;">深色配色</h3>${colorRows('dark')}</div>
        </div>
      </div>

      <div class="cfg-section">
        <h3>模块管理</h3>
        <p class="hint">可显隐、改名、排序内置模块；也可添加「外链 / 内部入口」轻量模块。复杂新模块仍需开发（预留能力）。</p>
        <div id="mod-list">${modulesHTML()}</div>
        <div class="card" style="margin-top:10px;">
          <h3 style="font-size:15px;">添加轻量模块（预留）</h3>
          <div class="cfg-row">
            <label>名称</label><input type="text" id="new-mod-label" placeholder="如 公司OA" style="width:160px;">
            <label>类型</label>
            <select id="new-mod-type"><option value="link">外链</option><option value="custom">内部入口</option></select>
            <label>地址</label><input type="text" id="new-mod-href" placeholder="https://... 或 页面路径" style="width:220px;">
            <button class="btn btn-primary" id="btn-add-mod">添加</button>
          </div>
        </div>
      </div>

      <div class="cfg-section">
        <h3>默认预设</h3>
        <div class="field"><label>任务默认标签</label><div id="tags-task">${tagsHTML(c.defaults.taskTags)}</div></div>
        <div class="field"><label>习惯打卡项</label><div id="tags-habit">${tagsHTML(c.defaults.habitItems)}</div></div>
        <div class="field"><label>知识库分类</label><div id="tags-kb">${tagsHTML(c.defaults.kbCategories)}</div></div>
      </div>

      <div class="cfg-section">
        <h3>看板布局</h3>
        <div class="cfg-row">
          ${['pending', 'dueToday', 'overdue', 'habitStreak'].map(k =>
            `<label><input type="checkbox" data-card="${k}" ${(c.dashboard.showCards || []).includes(k) ? 'checked' : ''}> ${CARD_LABELS[k]}</label>`).join('<span style="width:10px;"></span>')}
        </div>
        <div class="cfg-row">
          <label><input type="checkbox" id="dw-trend" ${c.dashboard.showWeekTrend !== false ? 'checked' : ''}> 显示近 7 日趋势</label>
          <label style="margin-left:14px;"><input type="checkbox" id="dw-cat" ${c.dashboard.showCategoryBreakdown !== false ? 'checked' : ''}> 显示分类占比</label>
        </div>
      </div>
    `;
    bind();
  }

  function bind() {
    const c = cfg();
    // 个人中心
    const un = document.getElementById('userName'), ur = document.getElementById('userRole');
    un.oninput = () => { c.profile.userName = un.value; document.getElementById('avatar').textContent = (un.value || '我').slice(0, 1); save(); };
    ur.oninput = () => { c.profile.role = ur.value; save(); };
    // 访问控制
    document.getElementById('btn-pw').onclick = () => changePw();
    document.getElementById('btn-lock').onclick = () => { PB.lock(); location.reload(); };
    // 云端同步（账号）
    bindCloud();
    // 备份
    document.getElementById('btn-export').onclick = exportData;
    const imp = document.getElementById('import-file');
    document.getElementById('btn-import').onclick = () => imp.click();
    imp.onchange = async () => {
      const f = imp.files[0]; if (!f) return;
      try { await PB.importJSON(await f.text()); PBUI.toast('导入成功，正在刷新'); location.reload(); }
      catch (e) { PBUI.toast('导入失败：文件格式错误'); }
    };
    // 站点与主题
    document.getElementById('siteName').oninput = e => { c.siteName = e.target.value; PBUI.renderChrome('profile'); save(); };
    document.querySelectorAll('input[name=mode]').forEach(r => r.onchange = () => {
      c.theme.mode = document.querySelector('input[name=mode]:checked').value;
      PBUI.applyTheme(c.theme); PBUI.renderChrome('profile'); save();
    });
    document.querySelectorAll('input[type=color][data-mode]').forEach(inp => inp.oninput = () => {
      c.theme[inp.dataset.mode][inp.dataset.key] = inp.value;
      const hex = document.querySelector(`input[data-hex="${inp.dataset.mode}"][data-key="${inp.dataset.key}"]`);
      if (hex) hex.value = inp.value;
      PBUI.applyTheme(c.theme); save();
    });
    document.querySelectorAll('input[data-hex]').forEach(inp => inp.oninput = () => {
      const v = inp.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        c.theme[inp.dataset.mode][inp.dataset.key] = v;
        const col = document.querySelector(`input[type=color][data-mode="${inp.dataset.mode}"][data-key="${inp.dataset.key}"]`);
        if (col) col.value = v;
        PBUI.applyTheme(c.theme); save();
      }
    });
    // 模块管理
    bindModules();
    // 预设标签
    bindTags('tags-task', c.defaults.taskTags);
    bindTags('tags-habit', c.defaults.habitItems);
    bindTags('tags-kb', c.defaults.kbCategories);
    // 看板布局
    document.querySelectorAll('input[data-card]').forEach(cb => cb.onchange = () => {
      const k = cb.dataset.card; const arr = c.dashboard.showCards;
      if (cb.checked) { if (!arr.includes(k)) arr.push(k); }
      else { c.dashboard.showCards = arr.filter(x => x !== k); }
      save();
    });
    document.getElementById('dw-trend').onchange = e => { c.dashboard.showWeekTrend = e.target.checked; save(); };
    document.getElementById('dw-cat').onchange = e => { c.dashboard.showCategoryBreakdown = e.target.checked; save(); };
  }

  function bindModules() {
    const c = cfg();
    document.querySelectorAll('#mod-list .mod-row').forEach(row => {
      const key = row.dataset.key;
      const m = c.modules.find(x => x.key === key); if (!m) return;
      const en = row.querySelector('[data-enable]'); if (en) en.onchange = () => { m.enabled = en.checked; save(); PBUI.renderChrome('profile'); };
      const lab = row.querySelector('[data-label]'); if (lab) lab.oninput = () => { m.label = lab.value; save(); PBUI.renderChrome('profile'); };
      const up = row.querySelector('[data-up]'); if (up && !up.disabled) up.onclick = () => { moveMod(key, -1); };
      const down = row.querySelector('[data-down]'); if (down && !down.disabled) down.onclick = () => { moveMod(key, 1); };
      const del = row.querySelector('[data-del]'); if (del) del.onclick = () => { c.modules = c.modules.filter(x => x.key !== key); save(); render(); PBUI.renderChrome('profile'); };
    });
    const add = document.getElementById('btn-add-mod');
    if (add) add.onclick = () => {
      const label = document.getElementById('new-mod-label').value.trim();
      const type = document.getElementById('new-mod-type').value;
      const href = document.getElementById('new-mod-href').value.trim();
      if (!label || !href) { PBUI.toast('请填写名称和地址'); return; }
      const maxOrder = c.modules.reduce((m, x) => Math.max(m, x.order || 0), 0);
      c.modules.push({ key: 'ext_' + Date.now().toString(36), label, type, href, enabled: true, order: maxOrder + 1 });
      save(); render(); PBUI.renderChrome('profile');
    };
  }
  function moveMod(key, dir) {
    const c = cfg();
    const sorted = c.modules.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const i = sorted.findIndex(m => m.key === key); const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const t = sorted[i].order; sorted[i].order = sorted[j].order; sorted[j].order = t;
    save(); render(); PBUI.renderChrome('profile');
  }

  function bindCloud() {
    const c = cfg();
    const area = document.getElementById('cloud-area');
    if (!area) return;
    if (PB.getCloudToken()) {
      const en = document.getElementById('cloud-en');
      if (en) en.onchange = () => { if (!c.cloud) c.cloud = {}; c.cloud.enabled = en.checked; save(); };
      const push = document.getElementById('btn-push');
      if (push) push.onclick = async () => { const r = await PB.cloudPush(); PBUI.toast(r.ok ? '已同步上传' : ('失败：' + (r.reason || ''))); if (r.ok) render(); };
      const pull = document.getElementById('btn-pull');
      if (pull) pull.onclick = async () => { const r = await PB.cloudPull(); PBUI.toast(r.ok ? (r.pulled ? '已拉取并合并' : '已是最新') : ('失败：' + (r.reason || ''))); if (r.ok) render(); };
      const out = document.getElementById('btn-logout');
      if (out) out.onclick = () => { PB.setCloudToken(null); localStorage.removeItem('pwb_cloud_user'); PBUI.toast('已退出账号'); render(); };
    } else {
      const login = document.getElementById('btn-login');
      if (login) login.onclick = async () => {
        const u = document.getElementById('cl-user').value.trim(), p = document.getElementById('cl-pass').value;
        if (!u || !p) { PBUI.toast('请输入账号和密码'); return; }
        try {
          const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || '登录失败');
          PB.setCloudToken(j.token); localStorage.setItem('pwb_cloud_user', u);
          if (!c.cloud) c.cloud = {}; c.cloud.enabled = true; save();
          PBUI.toast('登录成功，已开启云同步', 'ok'); render();
        } catch (e) { PBUI.toast(e.message, 'err'); }
      };
      const reg = document.getElementById('btn-reg');
      if (reg) reg.onclick = () => registerModal();
    }
  }

  function registerModal() {
    PBUI.openModal(`
      <h2>注册新账号</h2>
      <div class="field"><label>用户名</label><input type="text" id="rg-u"></div>
      <div class="field"><label>显示名</label><input type="text" id="rg-d"></div>
      <div class="field"><label>密码（≥6 位）</label><input type="password" id="rg-p"></div>
      <div class="gate-err" id="rg-err"></div>
      <div class="modal-foot"><button class="btn" onclick="PBUI.closeModal()">取消</button><button class="btn btn-primary" id="rg-go">注册</button></div>`);
    document.getElementById('rg-go').onclick = async () => {
      const u = document.getElementById('rg-u').value.trim(), p = document.getElementById('rg-p').value, d = document.getElementById('rg-d').value.trim() || u;
      const err = document.getElementById('rg-err');
      if (!u || !p) { err.textContent = '请输入账号和密码'; return; }
      try {
        const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p, displayName: d }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || '注册失败');
        PB.setCloudToken(j.token); localStorage.setItem('pwb_cloud_user', u);
        const c = cfg(); if (!c.cloud) c.cloud = {}; c.cloud.enabled = true; save();
        PBUI.closeModal(); PBUI.toast('注册成功，已开启云同步', 'ok'); render();
      } catch (e) { err.textContent = e.message; }
    };
  }

  function bindTags(id, arr) {
    const box = document.getElementById(id);
    box.querySelectorAll('[data-rm]').forEach(x => x.onclick = () => {
      const v = x.dataset.rm; const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); save(); render();
    });
    const add = box.querySelector('[data-add]');
    add.onkeydown = e => {
      if (e.key === 'Enter') {
        const v = add.value.trim(); if (v && !arr.includes(v)) { arr.push(v); save(); render(); }
      }
    };
  }

  function changePw() {
    PBUI.openModal(`
      <h2>修改密码</h2>
      <div class="field"><label>原密码</label><input type="password" id="opw"></div>
      <div class="field"><label>新密码</label><input type="password" id="npw"></div>
      <div class="field"><label>确认新密码</label><input type="password" id="npw2"></div>
      <div class="gate-err" id="pw-err"></div>
      <div class="modal-foot">
        <button class="btn" onclick="PBUI.closeModal()">取消</button>
        <button class="btn btn-primary" id="pw-go">确定</button>
      </div>`);
    document.getElementById('pw-go').onclick = async () => {
      const op = document.getElementById('opw').value, np = document.getElementById('npw').value, np2 = document.getElementById('npw2').value;
      const err = document.getElementById('pw-err');
      if (!op || !np) { err.textContent = '请填写完整'; return; }
      if (np !== np2) { err.textContent = '两次新密码不一致'; return; }
      const ok = await PB.changePassword(op, np);
      if (!ok) { err.textContent = '原密码错误'; return; }
      PBUI.closeModal(); PBUI.toast('密码已更新');
    };
  }

  function exportData() {
    const blob = new Blob([PB.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '个人工作台备份_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); URL.revokeObjectURL(a.href);
  }

  render();
})();
