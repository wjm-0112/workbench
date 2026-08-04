/* ===== 个人工作台 · 数据层 =====
 * 本地存储 + AES-GCM/PBKDF2 加密 + GitHub 同步 + 导出导入
 * 暴露全局对象 PB
 */
const PB = (function () {
  const STORAGE_KEY = 'pwb_data_v1';
  const SESSION_KEY = 'pwb_session_v1';
  const KEY_SESSION_KEY = 'pwb_keysession_v1';
  const SETTINGS_KEY = 'pwb_settings_v1';
  const SALT = new TextEncoder().encode('pwb-crayon-salt-v1');

  let cryptoKey = null;   // 当前解锁的 CryptoKey
  let data = null;        // 解密后的数据对象
  let saveTimer = null;

  /* ---------- 工具 ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function nowISO() { return new Date().toISOString(); }
  function emptyData() {
    return { tasks: [], notes: [], snippets: [], habits: [], meta: { version: 1, lastSyncAt: null } };
  }

  /* ---------- 加密 ---------- */
  async function deriveKey(password) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
  }
  async function encryptObj(obj, k) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const pt = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, pt);
    const out = new Uint8Array(iv.length + ct.byteLength);
    out.set(iv, 0); out.set(new Uint8Array(ct), iv.length);
    return btoa(String.fromCharCode.apply(null, out));
  }
  async function decryptObj(b64, k) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const iv = bytes.slice(0, 12), ct = bytes.slice(12);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, ct);
    return JSON.parse(new TextDecoder().decode(pt));
  }

  /* ---------- 会话内密钥持久化（仅 sessionStorage，关标签页即清） ---------- */
  // 跨页面整页刷新时，内存里的 CryptoKey 会丢失；把其 JWK 存进 sessionStorage，
  // 下次进页面用 restore() 导回，避免「encrypt 参数不是 CryptoKey」错误。
  async function storeKeySession() {
    try { sessionStorage.setItem(KEY_SESSION_KEY, JSON.stringify(await crypto.subtle.exportKey('jwk', cryptoKey))); } catch (e) {}
  }
  async function restore() {
    try {
      const kj = sessionStorage.getItem(KEY_SESSION_KEY);
      const ds = sessionStorage.getItem(SESSION_KEY);
      if (!kj || !ds) return false;
      cryptoKey = await crypto.subtle.importKey('jwk', JSON.parse(kj), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      data = JSON.parse(ds);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- 本地持久化 ---------- */
  function hasLocal() { return !!localStorage.getItem(STORAGE_KEY); }

  async function persist() {
    if (!cryptoKey || !data) return;
    const blob = await encryptObj(data, cryptoKey);
    localStorage.setItem(STORAGE_KEY, blob);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    scheduleSync();
  }
  function save() {        // 防抖保存
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 300);
  }
  function saveNow() {     // 立即保存（导入/关键操作后）
    clearTimeout(saveTimer);
    return persist();
  }

  /* ---------- 解锁 ---------- */
  // 返回 'first'（首次设置密码）| 'ok' | 'wrong'
  async function unlock(password) {
    const blob = localStorage.getItem(STORAGE_KEY);
    if (!blob) {
      cryptoKey = await deriveKey(password);
      await storeKeySession();
      data = emptyData();
      await persist();
      return 'first';
    }
    try {
      cryptoKey = await deriveKey(password);
      await storeKeySession();
      data = await decryptObj(blob, cryptoKey);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      return 'ok';
    } catch (e) {
      cryptoKey = null; data = null;
      return 'wrong';
    }
  }
  function isUnlocked() {
    if (cryptoKey && data) return true;
    const sess = sessionStorage.getItem(SESSION_KEY);
    if (sess) { try { data = JSON.parse(sess); return true; } catch (e) {} }
    return false;
  }
  function lock() { cryptoKey = null; data = null; sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(KEY_SESSION_KEY); }

  /* ---------- 数据访问 ---------- */
  function getData() { return data || emptyData(); }
  function touch(obj) { obj.updatedAt = nowISO(); return obj; }

  /* ---------- 设置（GitHub 同步） ---------- */
  function getSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { enabled: false }; }
    catch (e) { return { enabled: false }; }
  }
  function setSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

  /* ---------- GitHub 同步 ---------- */
  async function githubGet(settings) {
    const path = settings.path || 'data.json';
    const url = `https://api.github.com/repos/${settings.user}/${settings.repo}/contents/${path}`;
    const head = await fetch(url, { headers: { Authorization: 'Bearer ' + settings.token, Accept: 'application/vnd.github+json' } });
    if (head.status === 404) return null;
    if (!head.ok) throw new Error('GitHub 读取失败：' + head.status);
    const j = await head.json();
    return { content: j.content, sha: j.sha };
  }
  function mergeRemote(remoteData) {
    if (!remoteData || !data) return;
    ['tasks', 'notes', 'snippets', 'habits'].forEach((col) => {
      const localMap = new Map((data[col] || []).map((x) => [x.id, x]));
      (remoteData[col] || []).forEach((r) => {
        const l = localMap.get(r.id);
        if (!l || new Date(r.updatedAt || 0) > new Date(l.updatedAt || 0)) localMap.set(r.id, r);
      });
      data[col] = Array.from(localMap.values());
    });
    data.meta = Object.assign({}, data.meta, remoteData.meta || {});
  }
  async function syncPull() {
    const s = getSettings();
    if (!s.enabled || !s.token || !s.user || !s.repo) return { ok: false, reason: 'disabled' };
    if (!cryptoKey) return { ok: false, reason: '未解锁，请刷新页面重新输入密码' };
    try {
      const remote = await githubGet(s);
      if (!remote) return { ok: true, pulled: false };
      const remoteData = await decryptObj(remote.content, cryptoKey);
      mergeRemote(remoteData);
      await persist();
      return { ok: true, pulled: true };
    } catch (e) { return { ok: false, reason: e.message }; }
  }
  async function syncPush() {
    const s = getSettings();
    if (!s.enabled || !s.token || !s.user || !s.repo) return { ok: false, reason: 'disabled' };
    if (!cryptoKey) return { ok: false, reason: '未解锁，请刷新页面重新输入密码' };
    try {
      const blob = await encryptObj(data, cryptoKey);
      const path = s.path || 'data.json';
      const url = `https://api.github.com/repos/${s.user}/${s.repo}/contents/${path}`;
      let sha; const head = await fetch(url, { headers: { Authorization: 'Bearer ' + s.token, Accept: 'application/vnd.github+json' } });
      if (head.ok) sha = (await head.json()).sha;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + s.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'sync ' + new Date().toISOString(), content: blob, sha })
      });
      if (!res.ok) throw new Error('推送失败：' + res.status);
      data.meta.lastSyncAt = nowISO();
      await persist();
      return { ok: true };
    } catch (e) { return { ok: false, reason: e.message }; }
  }
  function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => { syncPush().then(() => {}); }, 1500); }
  let syncTimer = null;

  /* ---------- 导出 / 导入 ---------- */
  function exportJSON() { return JSON.stringify(data, null, 2); }
  async function importJSON(text) {
    const obj = JSON.parse(text);
    data = Object.assign(emptyData(), obj);
    await saveNow();
  }

  /* ---------- 修改密码 ---------- */
  async function changePassword(oldP, newP) {
    const blob = localStorage.getItem(STORAGE_KEY);
    try { await decryptObj(blob, await deriveKey(oldP)); }
    catch (e) { return false; }
    cryptoKey = await deriveKey(newP);
    await storeKeySession();
    await persist();
    return true;
  }

  return {
    uid, nowISO, emptyData, touch,
    unlock, isUnlocked, lock, getData, restore,
    save, saveNow, hasLocal,
    getSettings, setSettings,
    syncPull, syncPush,
    exportJSON, importJSON, changePassword
  };
})();
