/* 管理台 · 访问密码解锁（与 C 端同一密码、同一加密 localStorage） */
(function () {
  const card = document.getElementById('card');
  const first = !PB.hasLocal();

  function render() {
    card.innerHTML = `
      <h2>管理台解锁</h2>
      <p class="muted">${first ? '第一次使用，先设一个访问密码（用来加密本地数据）' : '请输入访问密码'}</p>
      <div class="field"><label>访问密码</label><input class="input" id="pw" type="password" autocomplete="off"></div>
      ${first ? '<div class="field"><label>确认密码</label><input class="input" id="pw2" type="password" autocomplete="off"></div>' : ''}
      <button class="btn primary" id="go" style="width:100%">${first ? '设定并进入' : '解锁'}</button>
      <p class="muted" id="err" style="color:#e5484d;text-align:center"></p>
      <p class="muted" style="text-align:center;margin-top:12px"><a href="../index.html">← 返回工作台</a></p>`;
    const go = document.getElementById('go');
    go.onclick = async () => {
      const p = document.getElementById('pw').value;
      const err = document.getElementById('err');
      if (!p) { err.textContent = '密码不能为空'; return; }
      if (first && p !== document.getElementById('pw2').value) { err.textContent = '两次输入不一致'; return; }
      const r = await PB.unlock(p);
      if (r === 'wrong') { err.textContent = '密码错误，请重试'; return; }
      location.href = 'index.html';
    };
    document.getElementById('pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') go.onclick(); });
  }
  render();
})();
