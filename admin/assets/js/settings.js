/* B 端后台 · 运营 / 配置 / 监控 */
(function () {
  Admin.register('ops', {
    title: '运营与配置',
    icon: '⚙️',
    async render(el) {
      const [set, audit, health] = await Promise.all([
        Admin.api('/admin/settings'),
        Admin.api('/admin/audit'),
        Admin.api('/admin/health'),
      ]);
      const s = set.settings || {};
      el.innerHTML = `
        <div class="grid split">
          <div class="card">
            <div class="panel-head"><h2>站点配置</h2></div>
            <div class="field"><label>站点名称</label><input class="input" id="siteName" value="${Admin.esc(s.siteName || '')}"></div>
            <div class="row">
              <div class="field"><label>品牌色</label><input class="input" id="brandColor" type="color" value="${Admin.esc(s.brandColor || '#2b4c7e')}" style="height:40px"></div>
              <div class="field"><label>开放注册</label>
                <select id="allowRegister"><option value="true" ${s.allowRegister ? 'selected' : ''}>允许</option><option value="false" ${!s.allowRegister ? 'selected' : ''}>关闭</option></select>
              </div>
            </div>
            <button class="btn primary" id="save">保存配置</button>
          </div>
          <div class="card">
            <div class="panel-head"><h2>系统监控</h2></div>
            <p>状态：<span class="badge ${health.ok ? 'ok' : 'warn'}">${health.ok ? '正常' : '异常'}</span></p>
            <p class="muted">运行时长：${Math.round(health.uptime)} 秒</p>
            <p class="muted">服务器时间：${Admin.fmtDate(health.time)} ${health.time ? health.time.slice(11, 19) : ''}</p>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="panel-head"><h2>审计日志（最近 100 条）</h2></div>
          <div class="table-wrap"><table>
            <thead><tr><th>时间</th><th>操作人</th><th>动作</th></tr></thead>
            <tbody>${(audit.audit || []).map((a) => `<tr><td class="muted">${Admin.fmtDate(a.at)} ${a.at ? a.at.slice(11, 19) : ''}</td><td>${Admin.esc(a.by)}</td><td>${Admin.esc(a.action)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">暂无记录</td></tr>'}</tbody>
          </table></div>
        </div>`;
      el.querySelector('#save').onclick = async () => {
        const payload = {
          siteName: el.querySelector('#siteName').value.trim(),
          brandColor: el.querySelector('#brandColor').value,
          allowRegister: el.querySelector('#allowRegister').value === 'true',
        };
        await Admin.api('/admin/settings', { method: 'PUT', body: payload });
        Admin.toast('已保存', 'ok');
      };
    },
  });
})();
