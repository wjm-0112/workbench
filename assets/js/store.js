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
    return { tasks: [], notes: [], habits: [], finance: [], savings: [], config: null, meta: { version: 1, lastSyncAt: null } };
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
      { key:'planner',  label:'综合', enabled:true, order:2, type:'page', icon:'layers', core:true },
      { key:'finance',  label:'财政', enabled:true, order:3, type:'page', icon:'wallet', core:true },
      { key:'profile',  label:'我的', enabled:true, order:4, type:'page', icon:'user', core:true }
    ],
    defaults: {
      taskTags: ['工作','生活','学习'],
      habitItems: ['喝水','读书','运动'],
      financeCategories: ['餐饮','交通','购物','居住','娱乐','医疗','收入','理财','其他'],
      accounts: [
        { id:'acc-builtin-1', type:'现金', name:'现金', initialBalance:0 },
        { id:'acc-builtin-2', type:'支付宝', name:'支付宝', initialBalance:0 },
        { id:'acc-builtin-3', type:'微信', name:'微信', initialBalance:0 },
        { id:'acc-builtin-4', type:'银行卡', name:'银行卡', bank:'（选填具体银行）', initialBalance:0 }
      ],
      savingsMethods: ['现金','银行卡','支付宝','微信','定期存款']
    },
    dashboard: { showCards:['pending','dueToday','overdue','habitStreak','monthFlow'], showWeekTrend:true, showCategoryBreakdown:true },
    cloud: { enabled:false, provider:'github', pat:'', owner:'', repo:'', path:'sync/data.json', sha:null },   // GitHub 云同步配置（PAT 存于加密 config 内）
    profile: { userName:'我', role:'会员' }
  };

  // 已下线的内置模块（纯前端化后移除，旧加密 blob 里的 modules 需过滤掉）
  const REMOVED_MODULE_KEYS = new Set(['content', 'orders', 'snippets']);

  // 习惯默认配色（不同习惯用不同颜色区分）
  const HABIT_PALETTE = ['#5B6CFF', '#1FC79B', '#FFB020', '#A56BFF', '#FF6B6B', '#3B82F6', '#34D399', '#F472B6', '#FBBF24', '#60A5FA'];

  /* ---------- 首次解锁预置（默认习惯，带配色） ---------- */
  function seedDefaults(d) {
    if (!d.habits || !d.habits.length) {
      d.habits = ['锻炼', '学习', '阅读', '喝水', '早起', '冥想'].map((name, i) => ({ id: uid(), name, color: HABIT_PALETTE[i % HABIT_PALETTE.length], checks: [] }));
    }
  }

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
    let mods = (target.modules && Array.isArray(target.modules) && target.modules.length)
      ? target.modules.filter(m => m && !REMOVED_MODULE_KEYS.has(m.key))
      : DEFAULT_CONFIG.modules.map(m => Object.assign({}, m));
    // 旧版 tasks/notes 两个独立模块 → 合并为单个「综合」(planner)
    if (!mods.some(m => m.key === 'planner')) {
      mods = mods.filter(m => m.key !== 'tasks' && m.key !== 'notes');
      mods.push({ key:'planner', label:'综合', enabled:true, order:2, type:'page', icon:'layers', core:true });
    } else {
      mods = mods.filter(m => m.key !== 'tasks' && m.key !== 'notes'); // 清掉可能残留的独立入口
    }
    // 补齐财政模块
    if (!mods.some(m => m.key === 'finance')) {
      mods.push({ key:'finance', label:'财政', enabled:true, order:4, type:'page', icon:'wallet', core:true });
    }
    // 规范化：4 个核心模块固定顺序（看板/综合/财政/我的），自定义外链模块排在后面
    const CORE_ORDER = { dashboard:1, planner:2, finance:3, profile:4 };
    mods.forEach(m => { if (CORE_ORDER[m.key] != null) { m.order = CORE_ORDER[m.key]; m.core = true; } });
    let e = 6;
    mods.filter(m => CORE_ORDER[m.key] == null).forEach(m => { if (m.order == null || m.order <= 5) { m.order = e; e++; } });
    mods.sort((a, b) => (a.order || 0) - (b.order || 0));
    out.modules = mods;
    return out;
  }
  // 把解密后的旧数据迁移到最新结构：旧明文同步键迁入加密 config
  function migrateConfig(d) {
    if (!d) d = emptyData();
    d.tasks = d.tasks || []; d.notes = d.notes || []; d.habits = d.habits || []; d.finance = d.finance || []; d.savings = d.savings || [];
    d.meta = d.meta || { version: 1, lastSyncAt: null };
    d.config = deepMergeConfig(d.config);
    // v2.4: 迁移旧的 financeAccounts 字符串数组 → accounts 对象数组
    const defs = d.config.defaults;
    if (!defs.accounts || !Array.isArray(defs.accounts) || !defs.accounts.length || (defs.accounts.length && typeof defs.accounts[0] === 'string')) {
      const old = (defs.accounts && Array.isArray(defs.accounts) && defs.accounts.length && typeof defs.accounts[0] === 'string') ? defs.accounts : (defs.financeAccounts || []);
      const typeMap = { '支付宝':'支付宝', '微信':'微信', '现金':'现金', '银行卡':'银行卡', '投资':'其他' };
      defs.accounts = old.map(s => ({ id: uid(), type: typeMap[s] || '其他', name: s, bank: (s === '银行卡' || s === '投资') ? s : undefined, initialBalance: 0 }));
      if (!defs.accounts.length) defs.accounts = [{ id: 'default-cash', type: '现金', name: '现金', initialBalance: 0 }];
    }
    delete defs.financeAccounts; // 清理旧字段
    // v2.4: 为旧的 finance 记录补齐 accountId（旧数据用文本 account 字段）
    const accList = defs.accounts || [];
    const accByName = new Map(accList.map(a => [a.name, a.id]));
    (d.finance || []).forEach(r => {
      if (!r.accountId) r.accountId = accByName.get(r.account || '') || (accList[0] ? accList[0].id : '');
    });
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
      seedDefaults(data);
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
    ['tasks', 'notes', 'habits', 'finance', 'savings'].forEach((col) => {
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
