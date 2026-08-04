/* ===== 个人工作台 · 数据层 =====
 * 本地存储 + AES-GCM/PBKDF2 加密 + GitHub 同步 + 导出导入 + 配置
 * 暴露全局对象 PB
 */
const PB = (function () {
  const STORAGE_KEY = 'pwb_data_v1';
  const SESSION_KEY = 'pwb_session_v1';
  const KEY_SESSION_KEY = 'pwb_keysession_v1';
  const SETTINGS_KEY = 'pwb_settings_v1';          // 旧明文同步键（迁移后删除）
  const SALT = new TextEncoder().encode('pwb-crayon-salt-v1');

  let cryptoKey = null;   // 当前解锁的 CryptoKey
  let data = null;        // 解密后的数据对象
  let saveTimer = null;
  let syncTimer = null;

  /* ---------- 工具 ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function nowISO() { return new Date().toISOString(); }
  function emptyData() {
    return { tasks: [], notes: [], snippets: [], habits: [], config: null, meta: { version: 1, lastSyncAt: null } };
  }

  /* ---------- 默认配置（双主题 / 模块 / 预设 / 看板 / 同步 / 个人） ---------- */
  const DEFAULT_CONFIG = {
    siteName: '我的工作台',
    theme: {
      mode: 'light',
      light: { primary:'#1E3A8A', accent:'#E5484D', bg:'#F5F7FA', surface:'#FFFFFF', ink:'#1F2329', muted:'#8A9099', success:'#2BA471', warn:'#F0A020', purple:'#7C5CFF', border:'#E5E7EB', radius:'8px', radiusLg:'14px' },
      dark:  { primary:'#60A5FA', accent:'#F87171', bg:'#0F172A', surface:'#1E293B', ink:'#E5E9F0', muted:'#94A3B8', success:'#34D399', warn:'#FBBF24', purple:'#A78BFA', border:'#334155', radius:'8px', radiusLg:'14px' },
      fontTitle: "system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif",
      fontBody: "system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif"
    },
    modules: [
      { key:'dashboard', label:'看板', enabled:true, order:1, type:'page', icon:'grid', core:true },
      { key:'tasks',    label:'任务', enabled:true, order:2, type:'page', icon:'check', core:true },
      { key:'notes',    label:'笔记', enabled:true, order:3, type:'page', icon:'note', core:true },
      { key:'snippets', label:'知识库', enabled:true, order:4, type:'page', icon:'book', core:true },
      { key:'profile',  label:'我的', enabled:true, order:5, type:'page', icon:'user', core:true }
    ],
    defaults: {
      taskTags: ['工作','生活','学习'],
      habitItems: ['喝水','读书','运动'],
      kbCategories: ['通用','前端','后端','API','命令','SQL']
    },
    dashboard: { showCards:['pending','dueToday','overdue','habitStreak'], showWeekTrend:true, showCategoryBreakdown:true },
    sync: { enabled:false, user:'', repo:'', token:'', path:'data.json' },
    profile: { userName:'我', role:'管理员' }
  };

  /* ---------- 配置合并 / 迁移 ---------- */
  function deepMergeConfig(target) {
    target = target || {};
    const out = Object.assign({}, DEFAULT_CONFIG, target);
    out.theme = Object.assign({}, DEFAULT_CONFIG.theme, target.theme || {});
    out.theme.light = Object.assign({}, DEFAULT_CONFIG.theme.light, (target.theme && target.theme.light) || {});
    out.theme.dark  = Object.assign({}, DEFAULT_CONFIG.theme.dark,  (target.theme && target.theme.dark)  || {});
    out.defaults  = Object.assign({}, DEFAULT_CONFIG.defaults, target.defaults || {});
    out.dashboard = Object.assign({}, DEFAULT_CONFIG.dashboard, target.dashboard || {});
    out.sync      = Object.assign({}, DEFAULT_CONFIG.sync, target.sync || {});
    out.profile   = Object.assign({}, DEFAULT_CONFIG.profile, target.profile || {});
    out.siteName  = target.siteName || DEFAULT_CONFIG.siteName;
    out.modules   = (target.modules && Array.isArray(target.modules) && target.modules.length)
      ? target.modules
      : DEFAULT_CONFIG.modules.map(m => Object.assign({}, m));
    return out;
  }
  // 把解密后的旧数据迁移到最新结构：旧 snippets(code→body)、旧明文同步键迁入加密 config
  function migrateConfig(d) {
    if (!d) d = emptyData();
    d.tasks = d.tasks || []; d.notes = d.notes || []; d.snippets = d.snippets || []; d.habits = d.habits || [];
    d.meta = d.meta || { version: 1, lastSyncAt: null };
    // 旧「速查」{title,code,lang,tags} → 知识库 {title,summary,body,category,tags}
    d.snippets.forEach(s => {
      if (s.code != null && s.body == null) s.body = s.code;
      if (s.summary == null) s.summary = '';
      if (s.category == null) s.category = '通用';
      delete s.code; delete s.lang;
    });
    // 旧明文同步键 → 加密 config.sync
    d.config = deepMergeConfig(d.config);
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch (e) { legacy = null; }
    if (legacy && legacy.token) {
      d.config.sync = Object.assign({}, d.config.sync, {
        enabled: !!legacy.enabled, user: legacy.user || '', repo: legacy.repo || '',
        token: legacy.token || '', path: legacy.path || 'data.json'
      });
      try { localStorage.removeItem(SETTINGS_KEY); } catch (e) {}
    }
    return d;
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
  async function storeKeySession() {
    try { sessionStorage.setItem(KEY_SESSION_KEY, JSON.stringify(await crypto.subtle.exportKey('jwk', cryptoKey))); } catch (e) {}
  }
  async function restore() {
    try {
      const kj = sessionStorage.getItem(KEY_SESSION_KEY);
      const ds = sessionStorage.getItem(SESSION_KEY);
      if (!kj || !ds) return false;
      cryptoKey = await crypto.subtle.importKey('jwk', JSON.parse(kj), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      data = migrateConfig(JSON.parse(ds));
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
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 300); }
  function saveNow() { clearTimeout(saveTimer); return persist(); }

  /* ---------- 解锁 ---------- */
  async function unlock(password) {
    const blob = localStorage.getItem(STORAGE_KEY);
    if (!blob) {
      cryptoKey = await deriveKey(password);
      await storeKeySession();
      data = migrateConfig(emptyData());
      await persist();
      return 'first';
    }
    try {
      cryptoKey = await deriveKey(password);
      await storeKeySession();
      data = migrateConfig(await decryptObj(blob, cryptoKey));
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      return 'ok';
    } catch (e) {
      cryptoKey = null; data = null;
      return 'wrong';
    }
  }
  // 仅当内存里同时存在密钥与数据才算解锁；data 的恢复必须伴随密钥恢复（由 restore() 完成）。
  function isUnlocked() { return !!(cryptoKey && data); }
  function lock() {
    cryptoKey = null; data = null;
    sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(KEY_SESSION_KEY);
  }

  /* ---------- 数据访问 ---------- */
  function getData() { return data || emptyData(); }
  function touch(obj) { obj.updatedAt = nowISO(); return obj; }

  /* ---------- 配置访问 ---------- */
  function getConfig() { return (data && data.config) ? data.config : DEFAULT_CONFIG; }
  function setConfig(cfg) { if (!data) return; data.config = cfg; save(); }
  function updateConfig(fn) { const c = getConfig(); fn(c); setConfig(c); }

  /* ---------- GitHub 同步（凭据来自加密 config.sync） ---------- */
  function syncSettings() { return ((data && data.config && data.config.sync) || DEFAULT_CONFIG.sync); }
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
    const s = syncSettings();
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
    const s = syncSettings();
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

  /* ---------- 导出 / 导入 ---------- */
  function exportJSON() { return JSON.stringify(data, null, 2); }
  async function importJSON(text) {
    const obj = JSON.parse(text);
    data = migrateConfig(Object.assign(emptyData(), obj));
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
    unlock, isUnlocked, lock, getData, restore, migrateConfig,
    save, saveNow, hasLocal,
    getConfig, setConfig, updateConfig,
    syncPull, syncPush,
    exportJSON, importJSON, changePassword
  };
})();
