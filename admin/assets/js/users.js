/* B 端后台 · 用户 / 角色 / 租户（权限与多租户） */
(function () {
  Admin.register('access', {
    title: '用户与权限',
    icon: '🔐',
    async render(el) {
      el.innerHTML = `
        <div class="toolbar">
          <button class="btn" data-tab="users" style="border-color:var(--brand);color:var(--brand)">用户</button>
          <button class="btn" data-tab="roles">角色</button>
          <button class="btn" data-tab="tenants">租户</button>
        </div>
        <div id="tabBody"></div>`;
      const tabs = el.querySelectorAll('[data-tab]');
      const show = (t) => {
        tabs.forEach((b) => (b.style.borderColor = b.dataset.tab === t ? 'var(--brand)' : 'var(--border)', b.style.color = b.dataset.tab === t ? 'var(--brand)' : 'var(--text)'));
        if (t === 'users') renderUsers(el.querySelector('#tabBody'));
        if (t === 'roles') renderRoles(el.querySelector('#tabBody'));
        if (t === 'tenants') renderTenants(el.querySelector('#tabBody'));
      };
      tabs.forEach((b) => (b.onclick = () => show(b.dataset.tab)));
      show('users');
    },
  });

  async function renderUsers(host) {
    const s = await Admin.api('/admin/users');
    const roles = (await Admin.api('/admin/roles')).roles;
    const roleOpts = (sel) => roles.map((r) => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${Admin.esc(r.name)}</option>`).join('');
    host.innerHTML = `
      <div class="toolbar"><button class="btn primary" id="add">＋ 新建用户</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>用户名</th><th>显示名</th><th>角色</th><th>租户</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody>${s.users.map((u) => `<tr>
          <td>${Admin.esc(u.username)}</td><td>${Admin.esc(u.displayName)}</td>
          <td><select data-role="${u.id}">${roleOpts(u.role)}</select></td>
          <td class="muted">${Admin.esc(u.tenantId)}</td>
          <td class="muted">${Admin.fmtDate(u.createdAt)}</td>
          <td><button class="btn sm danger" data-del="${u.id}">删除</button></td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    host.querySelector('#add').onclick = async () => {
      const username = prompt('用户名'); if (!username) return;
      const password = prompt('初始密码（至少 6 位）'); if (!password) return;
      await Admin.api('/admin/users', { method: 'POST', body: { username, password, displayName: username } });
      Admin.toast('已创建', 'ok'); renderUsers(host);
    };
    host.querySelectorAll('[data-role]').forEach((sel) => (sel.onchange = async () => {
      await Admin.api('/admin/users/' + sel.dataset.role, { method: 'PUT', body: { role: sel.value } });
      Admin.toast('角色已更新', 'ok');
    }));
    host.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!confirm('确定删除该用户？')) return;
      await Admin.api('/admin/users/' + b.dataset.del, { method: 'DELETE' });
      Admin.toast('已删除', 'ok'); renderUsers(host);
    }));
  }

  async function renderRoles(host) {
    const s = await Admin.api('/admin/roles');
    host.innerHTML = `
      <div class="toolbar"><button class="btn primary" id="add">＋ 新建角色</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>名称</th><th>权限</th><th>操作</th></tr></thead>
        <tbody>${s.roles.map((r) => `<tr><td>${Admin.esc(r.name)}</td><td class="muted">${(r.perms || []).join(', ') || '*'}</td><td><button class="btn sm danger" data-del="${r.id}">删除</button></td></tr>`).join('')}</tbody>
      </table></div>`;
    host.querySelector('#add').onclick = async () => {
      const name = prompt('角色名'); if (!name) return;
      await Admin.api('/admin/roles', { method: 'POST', body: { name, perms: ['content:read'] } });
      Admin.toast('已创建', 'ok'); renderRoles(host);
    };
    host.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!confirm('确定删除该角色？')) return;
      await Admin.api('/admin/roles/' + b.dataset.del, { method: 'DELETE' });
      Admin.toast('已删除', 'ok'); renderRoles(host);
    }));
  }

  async function renderTenants(host) {
    const s = await Admin.api('/admin/tenants');
    host.innerHTML = `
      <div class="toolbar"><button class="btn primary" id="add">＋ 新建租户</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>名称</th><th>ID</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody>${s.tenants.map((t) => `<tr><td>${Admin.esc(t.name)}</td><td class="muted">${Admin.esc(t.id)}</td><td class="muted">${Admin.fmtDate(t.createdAt)}</td><td><button class="btn sm danger" data-del="${t.id}">删除</button></td></tr>`).join('')}</tbody>
      </table></div>`;
    host.querySelector('#add').onclick = async () => {
      const name = prompt('租户名'); if (!name) return;
      await Admin.api('/admin/tenants', { method: 'POST', body: { name } });
      Admin.toast('已创建', 'ok'); renderTenants(host);
    };
    host.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!confirm('确定删除该租户？')) return;
      await Admin.api('/admin/tenants/' + b.dataset.del, { method: 'DELETE' });
      Admin.toast('已删除', 'ok'); renderTenants(host);
    }));
  }
})();
