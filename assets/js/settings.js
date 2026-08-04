function renderSettings() {
  const s = PB.getSettings();
  document.getElementById('gh-enabled').checked = !!s.enabled;
  document.getElementById('gh-user').value = s.user || '';
  document.getElementById('gh-repo').value = s.repo || '';
  document.getElementById('gh-token').value = s.token || '';
  document.getElementById('gh-path').value = s.path || 'data.json';
}
function saveSettings() {
  const s = {
    enabled: document.getElementById('gh-enabled').checked,
    user: document.getElementById('gh-user').value.trim(),
    repo: document.getElementById('gh-repo').value.trim(),
    token: document.getElementById('gh-token').value.trim(),
    path: document.getElementById('gh-path').value.trim() || 'data.json'
  };
  PB.setSettings(s); PBUI.toast('同步设置已保存');
}
async function testSync() {
  saveSettings();
  const s = PB.getSettings();
  if (!s.user || !s.repo || !s.token) { PBUI.toast('请先填用户名/仓库/令牌'); return; }
  const r = await PB.syncPush();
  if (r.ok) PBUI.toast('同步成功 ✅'); else PBUI.toast('同步失败：' + (r.reason || ''));
}
function changePw() {
  PBUI.openModal(`<h2>修改访问密码</h2>
    <div class="field"><label>当前密码</label><input type="password" id="oldp"></div>
    <div class="field"><label>新密码</label><input type="password" id="newp"></div>
    <div class="field"><label>再输一次</label><input type="password" id="newp2"></div>
    <div class="toolbar"><button class="btn btn-primary" id="pwok">确定修改</button><button class="btn btn-ghost" id="pwcancel">取消</button></div>`);
  document.getElementById('pwcancel').onclick = PBUI.closeModal;
  document.getElementById('pwok').onclick = async () => {
    const oldp = document.getElementById('oldp').value, newp = document.getElementById('newp').value, newp2 = document.getElementById('newp2').value;
    if (!oldp || !newp) { PBUI.toast('密码不能为空'); return; }
    if (newp !== newp2) { PBUI.toast('两次新密码不一致'); return; }
    const ok = await PB.changePassword(oldp, newp);
    if (!ok) { PBUI.toast('当前密码错误'); return; }
    PBUI.closeModal(); PBUI.toast('密码已修改');
  };
}
function exportData() {
  const blob = new Blob([PB.exportJSON()], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = '个人工作台备份.json'; a.click();
  PBUI.toast('已导出备份');
}
function importData(file) {
  const r = new FileReader();
  r.onload = async () => {
    try { await PB.importJSON(r.result); PBUI.closeModal(); PBUI.toast('导入成功，正在刷新'); setTimeout(() => location.reload(), 400); }
    catch (e) { PBUI.toast('导入失败：文件格式不对'); }
  };
  r.readAsText(file);
}

window.addEventListener('DOMContentLoaded', async () => {
  PBUI.renderChrome('settings');
  const ok = await PBUI.ensureUnlocked();
  if (!ok) return;
  renderSettings();
  document.getElementById('save-gh').onclick = saveSettings;
  document.getElementById('test-sync').onclick = testSync;
  document.getElementById('change-pw').onclick = changePw;
  document.getElementById('export').onclick = exportData;
  document.getElementById('import-file').onchange = e => { if (e.target.files[0]) importData(e.target.files[0]); };
  document.getElementById('lock').onclick = () => { PB.lock(); location.reload(); };
});
