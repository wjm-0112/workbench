/* B 端后台 · 登录页逻辑 */
(function () {
  const TOKEN_KEY = 'pwb_admin_token';
  const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));
  const api = async (path, body) => {
    const res = await fetch('/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || '请求失败');
    return data;
  };
  const toast = (m, t) => {
    const w = document.querySelector('.toast-wrap') || (() => { const d = document.createElement('div'); d.className = 'toast-wrap'; document.body.appendChild(d); return d; })();
    const e = document.createElement('div'); e.className = 'toast ' + (t || ''); e.textContent = m; w.appendChild(e); setTimeout(() => e.remove(), 2600);
  };

  function show(mode) {
    document.getElementById('card').innerHTML = mode === 'register'
      ? `<h2>创建管理员账号</h2>
         <div class="field"><label>用户名</label><input class="input" id="u"></div>
         <div class="field"><label>显示名</label><input class="input" id="d"></div>
         <div class="field"><label>密码（≥6 位）</label><input class="input" id="p" type="password"></div>
         <button class="btn primary" id="go" style="width:100%">注册</button>
         <p class="muted" style="text-align:center;margin-top:14px">已有账号？<a href="#" id="toLogin">去登录</a></p>`
      : `<h2>登录管理后台</h2>
         <div class="field"><label>用户名</label><input class="input" id="u"></div>
         <div class="field"><label>密码</label><input class="input" id="p" type="password"></div>
         <button class="btn primary" id="go" style="width:100%">登录</button>
         <p class="muted" style="text-align:center;margin-top:14px">默认账号 admin / admin123</p>`;
    document.getElementById('toLogin') && (document.getElementById('toLogin').onclick = (e) => { e.preventDefault(); show('login'); });
    document.getElementById('go').onclick = async () => {
      const u = document.getElementById('u').value.trim();
      const p = document.getElementById('p').value;
      try {
        if (mode === 'register') {
          const d = document.getElementById('d').value.trim() || u;
          await api('/auth/register', { username: u, password: p, displayName: d });
          toast('注册成功，请登录', 'ok');
          show('login');
        } else {
          const r = await api('/auth/login', { username: u, password: p });
          setToken(r.token);
          location.href = 'index.html';
        }
      } catch (e) { toast(e.message, 'err'); }
    };
  }
  show('login');
})();
