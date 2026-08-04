/* ===== 个人工作台 · 数据层（C 端） =====
 * 本地存储 + AES-GCM/PBKDF2 加密（随机盐）+ GitHub 仓库云同步 + 导出导入 + 配置
 * 暴露全局对象 PB
 *
 * 云同步说明：数据以「访问密码」做客户端端到端加密（随机盐），密文存到 GitHub 仓库文件；
 * GitHub 令牌(PAT) 仅作为把加密 blob 传到仓库的「传输凭证」，与加密密码分离，服务端只见密文。
 */
const PB = (function () {
  const STORAGE_KEY = 'pwb_data_v1';
  const SESSION_KEY = 'pwb_session_v1';
  const KEY_SESSION_KEY = 'pwb_keysession_v1';
  const PASS_SESSION_KEY = 'pwb_pass_v1';          // 仅 sessionStorage，同标签页免重复输密码
  const SETTINGS_KEY = 'pwb_settings_v1';          // 旧明文同步键（迁移后删除）
  const LEGACY_SALT = new TextEncoder().encode('pwb-crayon-salt-v1'); // 仅用于解密旧格式 blob

  let cryptoKey = null;   // 当前解锁的 CryptoKey（用于会话 JWK 持久化）
  let accessPassword = null; // 访问密码（用于按随机盐重新派生密钥）
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
      light: { primary:'#5B6CFF', accent:'#FF6B6B', bg:'#F4F6FB', surface:'#FFFFFF', ink:'#1D2330', muted:'#8A90A2', success:'#1FC79B', warn:'#FFB020', purple:'#A56BFF', border:'#ECEEF5', radius:'12px', radiusLg:'20px' },
      dark:  { primary:'#7C8CFF', accent:'#FF7B7B', bg:'#0E1220', surface:'#171C2E', ink:'#E8ECF6', muted:'#9AA1B8', success:'#34D399', warn:'#FBBF24', purple:'#B98BFF', border:'#262B40', radius:'12px', radiusLg:'20px' },
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
    cloud: { enabled:false, provider:'github', pat:'', owner:'', repo:'', path:'sync/data.json', sha:null },   // GitHub 云同步配置（PAT 存于加密 config 内）
    profile: { userName:'我', role:'会员' }
  };

  // 已下线的内置模块（纯前端化后移除，旧加密 blob 里的 modules 需过滤掉）
  const REMOVED_MODULE_KEYS = new Set(['content', 'orders']);

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
      ? target.modules.filter(m => m && !REMOVED_MODULE_KEYS.has(m.key))
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
    d.config = deepMergeConfig(d.config);
    // 清理旧的明文同步键（已废弃）
    try { localStorage.removeItem(SETTINGS_KEY); } catch (e) {}
    return d;
  }

  /* ---------- 加密（随机盐 + 版本化格式 + 分块 base64） ---------- */
  async function deriveKey(password, saltBytes) {
    const salt = saltBytes || LEGACY_SALT;
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
  }
  // 分块 base64，避免大数组 apply 触发 RangeError
  function bytesToB64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
  }
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  // 新格式：版本(1B=2) + 随机盐(16B) + IV(12B) + 密文
  async function encryptObj(obj, password) {
    const pw = password || accessPassword;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pw, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
    const out = new Uint8Array(1 + 16 + 12 + ct.byteLength);
    out[0] = 2;
    out.set(salt, 1); out.set(iv, 17); out.set(new Uint8Array(ct), 29);
    return bytesToB64(out);
  }
  async function decryptObj(b64, password) {
    const pw = password || accessPassword;
    const bytes = b64ToBytes(b64);
    let salt, iv, ct;
    if (bytes[0] === 2) { salt = bytes.slice(1, 17); iv = bytes.slice(17, 29); ct = bytes.slice(29); }
    else { salt = LEGACY_SALT; iv = bytes.slice(0, 12); ct = bytes.slice(12); } // 旧格式兼容
    const key = await deriveKey(pw, salt);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(pt));
  }

  /* ---------- 会话内密钥/密码持久化（仅 sessionStorage，关标签页即清） ---------- */
  async function storeKeySession() {
    try {
      sessionStorage.setItem(KEY_SESSION_KEY, JSON.stringify(await crypto.subtle.exportKey('jwk', cryptoKey)));
      if (accessPassword) sessionStorage.setItem(PASS_SESSION_KEY, accessPassword);
    } catch (e) {}
  }
  async function restore() {
    try {
      const kj = sessionStorage.getItem(KEY_SESSION_KEY);
      const ds = sessionStorage.getItem(SESSION_KEY);
      const pw = sessionStorage.getItem(PASS_SESSION_KEY);
      if (!kj || !ds) return false;
      cryptoKey = await crypto.subtle.importKey('jwk', JSON.parse(kj), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      accessPassword = pw;
      data = migrateConfig(JSON.parse(ds));
      return true;
    } catch (e) { return false; }
  }

  /* ---------- 本地持久化 ---------- */
  function hasLocal() { return !!localStorage.getItem(STORAGE_KEY); }

  async function persist() {
    if (!cryptoKey || !data || !accessPassword) return;
    const blob = await encryptObj(data, accessPassword);
    localStorage.setItem(STORAGE_KEY, blob);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    scheduleSync();
  }
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 300); }
  function saveNow() { clearTimeout(saveTimer); return persist(); }

  /* ---------- 解锁 ---------- */
  async function unlock(password) {
    const blob = localStorage.getItem(STORAGE_KEY);
    accessPassword = password;
    if (!blob) {
      cryptoKey = await deriveKey(password, LEGACY_SALT);
      await storeKeySession();
      data = migrateConfig(emptyData());
      await persist();
      return 'first';
    }
    try {
      cryptoKey = await deriveKey(password, LEGACY_SALT);
      await storeKeySession();
      data = migrateConfig(await decryptObj(blob, password));
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      return 'ok';
    } catch (e) {
      cryptoKey = null; data = null; accessPassword = null;
      return 'wrong';
    }
  }
  function isUnlocked() { return !!(cryptoKey && data); }
  function lock() {
    cryptoKey = null; data = null; accessPassword = null;
    sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(KEY_SESSION_KEY); sessionStorage.removeItem(PASS_SESSION_KEY);
  }

  /* ---------- 数据访问 ---------- */
  function getData() { return data || emptyData(); }
  function touch(obj) { obj.updatedAt = nowISO(); return obj; }

  /* ---------- 配置访问 ---------- */
  function getConfig() { return (data && data.config) ? data.config : DEFAULT_CONFIG; }
  function setConfig(cfg) { if (!data) return; data.config = cfg; save(); }
  function updateConfig(fn) { const c = getConfig(); fn(c); setConfig(c); }

  /* ---------- 云端同步（GitHub 仓库文件，端到端加密） ---------- */
  function cloudEnabled() { return !!(data && data.config && data.config.cloud && data.config.cloud.enabled); }
  function cloudCfg() { return (data && data.config && data.config.cloud) || {}; }
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
  async function cloudPush() {
    const c = cloudCfg();
    if (!cloudEnabled() || !c.pat || !accessPassword) return { ok: false, reason: 'disabled' };
    try {
      const blob = await encryptObj(data, accessPassword);
      const r = await GitHubSync.githubPush({ pat: c.pat, owner: c.owner, repo: c.repo, path: c.path || 'sync/data.json', b64: blob, sha: c.sha || null });
      c.sha = r.sha;                 // 记录 sha，下次更新用（GitHub 要求）
      data.meta.lastSyncAt = nowISO();
      return { ok: true };
    } catch (e) { return { ok: false, reason: e.message }; }
  }
  async function cloudPull() {
    const c = cloudCfg();
    if (!cloudEnabled() || !c.pat || !accessPassword) return { ok: false, reason: 'disabled' };
    try {
      const r = await GitHubSync.githubPull({ pat: c.pat, owner: c.owner, repo: c.repo, path: c.path || 'sync/data.json' });
      if (r.missing) return { ok: true, pulled: false, missing: true };
      const remoteData = await decryptObj(r.b64, accessPassword);
      c.sha = r.sha;
      mergeRemote(remoteData);
      await persist();
      return { ok: true, pulled: true };
    } catch (e) { return { ok: false, reason: e.message }; }
  }
  function scheduleSync() {
    if (!cloudEnabled() || !cloudCfg().pat) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { cloudPush().then(() => {}); }, 1500);
  }

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
    try { await decryptObj(blob, oldP); }
    catch (e) { return false; }
    accessPassword = newP;
    cryptoKey = await deriveKey(newP, LEGACY_SALT);
    await storeKeySession();
    await persist();
    return true;
  }

  return {
    uid, nowISO, emptyData, touch,
    unlock, isUnlocked, lock, getData, restore, migrateConfig,
    save, saveNow, hasLocal,
    getConfig, setConfig, updateConfig,
    cloudPush, cloudPull, cloudEnabled,
    exportJSON, importJSON, changePassword
  };
})();
