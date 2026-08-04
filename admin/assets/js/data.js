/* 管理台 · 数据管理（导出/导入/云同步/清空，纯本地） */
(function () {
  Admin.register('data', {
    title: '数据管理',
    icon: '💾',
    render(el) {
      const d = Admin.data();
      const cfg = Admin.config();
      const cloud = cfg.cloud || {};
      const lastSync = (d.meta && d.meta.lastSyncAt) ? new Date(d.meta.lastSyncAt).toLocaleString('zh-CN') : '尚未同步';
      const bytes = new Blob([PB.exportJSON()]).size;

      el.innerHTML = `
        <div class="card">
          <div class="panel-head"><h2>备份与恢复</h2></div>
          <p class="muted">导出为明文 JSON 自行保管；导入会覆盖当前数据。</p>
          <div class="toolbar">
            <button class="btn primary" id="exp">导出备份</button>
            <button class="btn" id="imp">导入备份</button>
            <input type="file" id="impFile" accept="application/json,.json" style="display:none">
            <span class="muted">当前数据约 ${Admin.esc(bytes)} 字节</span>
          </div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="panel-head"><h2>GitHub 云同步</h2></div>
          <p class="muted">仓库 <b>${Admin.esc((cloud.owner || '') + '/' + (cloud.repo || ''))}</b> · 路径 ${Admin.esc(cloud.path || 'sync/data.json')}</p>
          <p class="muted">最近同步：${Admin.esc(lastSync)}</p>
          <div class="toolbar">
            <button class="btn primary" id="push">立即上传</button>
            <button class="btn" id="pull">拉取合并</button>
            <button class="btn" id="test">测试连接</button>
          </div>
          <p class="muted">详细配置（令牌 / owner / repo / 路径 / 启停）请在 C 端「我的 → 云端同步（GitHub）」中设置。</p>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="panel-head"><h2>危险区</h2></div>
          <p class="muted">清空将删除本设备全部本地数据（加密 blob），且无法恢复。请先导出备份。</p>
          <button class="btn danger" id="reset">清空本地数据</button>
        </div>`;

      el.querySelector('#exp').onclick = () => {
        const blob = new Blob([PB.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '个人工作台备份_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click(); URL.revokeObjectURL(a.href);
      };
      const impFile = el.querySelector('#impFile');
      el.querySelector('#imp').onclick = () => impFile.click();
      impFile.onchange = async () => {
        const f = impFile.files[0]; if (!f) return;
        try { await PB.importJSON(await f.text()); Admin.toast('导入成功', 'ok'); location.reload(); }
        catch (e) { Admin.toast('导入失败：' + e.message, 'err'); }
      };
      el.querySelector('#push').onclick = async () => {
        if (!cloud.enabled || !cloud.pat) { Admin.toast('请先在 C 端配置 GitHub 同步', 'err'); return; }
        const r = await PB.cloudPush(); Admin.toast(r.ok ? '已上传' : ('失败：' + (r.reason || '')), r.ok ? 'ok' : 'err');
        if (r.ok) render(el);
      };
      el.querySelector('#pull').onclick = async () => {
        if (!cloud.enabled || !cloud.pat) { Admin.toast('请先在 C 端配置 GitHub 同步', 'err'); return; }
        const r = await PB.cloudPull(); Admin.toast(r.ok ? (r.pulled ? '已拉取合并' : (r.missing ? '远端暂无数据' : '已是最新')) : ('失败：' + (r.reason || '')), r.ok ? 'ok' : 'err');
        if (r.ok) render(el);
      };
      el.querySelector('#test').onclick = async () => {
        if (!cloud.pat || !cloud.owner || !cloud.repo) { Admin.toast('请先在 C 端配置 GitHub 同步', 'err'); return; }
        try { const r = await GitHubSync.testConnection({ pat: cloud.pat, owner: cloud.owner, repo: cloud.repo }); Admin.toast('连接成功：' + (r.name || ''), 'ok'); }
        catch (e) { Admin.toast('失败：' + e.message, 'err'); }
      };
      el.querySelector('#reset').onclick = () => {
        Admin.modal('确认清空本地数据？', '<p class="muted">此操作不可恢复，请确保已导出备份。</p>', () => {
          localStorage.removeItem('pwb_data_v1');
          sessionStorage.clear();
          Admin.toast('已清空', 'ok');
          setTimeout(() => location.reload(), 600);
        });
      };
    },
  });
})();
