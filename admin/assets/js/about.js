/* 管理台 · 关于 */
(function () {
  Admin.register('about', {
    title: '关于',
    icon: 'ℹ️',
    render(el) {
      const cfg = Admin.config();
      const bytes = new Blob([PB.exportJSON()]).size;
      el.innerHTML = `
        <div class="card">
          <div class="panel-head"><h2>个人工作台 · 管理台</h2></div>
          <p>版本：<b>v2.1（纯前端）</b></p>
          <p class="muted">纯前端架构，无任何服务器。所有数据用访问密码在浏览器内端到端加密，存于本地；云同步通过 GitHub 仓库文件实现。</p>
          <p class="muted">当前站点名：${Admin.esc(cfg.siteName || '我的工作台')}</p>
          <p class="muted">本地数据占用：约 ${Admin.esc(bytes)} 字节</p>
          <div class="toolbar">
            <a class="btn" href="../index.html">← 返回工作台（C 端）</a>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="panel-head"><h2>技术说明</h2></div>
          <ul class="muted" style="line-height:1.8">
            <li>加密：Web Crypto · AES-GCM 256 + PBKDF2（随机盐）</li>
            <li>存储：浏览器 localStorage（加密 blob）</li>
            <li>云同步：GitHub Contents API（PAT 作传输凭证）</li>
            <li>部署：GitHub Pages / 任意静态托管</li>
          </ul>
        </div>`;
    },
  });
})();
