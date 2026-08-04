/**
 * 轻量本地文件存储（零原生依赖）
 * 集合以 JSON 文件持久化在 server/data/ 下，单进程开发/演示足够。
 * 生产可无缝替换为 SQLite / Postgres，接口保持一致。
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const CACHE = {};

function fileFor(col) {
  return path.join(DATA_DIR, `${col}.json`);
}

function load(col) {
  if (CACHE[col]) return CACHE[col];
  try {
    CACHE[col] = JSON.parse(fs.readFileSync(fileFor(col), 'utf8'));
  } catch (e) {
    CACHE[col] = [];
  }
  return CACHE[col];
}

function persist(col) {
  fs.writeFileSync(fileFor(col), JSON.stringify(CACHE[col], null, 2));
}

function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const db = {
  uid,
  all(col) {
    return load(col);
  },
  find(col, fn) {
    return load(col).find(fn);
  },
  filter(col, fn) {
    return load(col).filter(fn);
  },
  insert(col, doc) {
    const arr = load(col);
    arr.push(doc);
    persist(col);
    return doc;
  },
  update(col, id, patch) {
    const arr = load(col);
    const i = arr.findIndex((x) => x.id === id);
    if (i === -1) return null;
    arr[i] = { ...arr[i], ...patch, id };
    persist(col);
    return arr[i];
  },
  remove(col, id) {
    const arr = load(col);
    const i = arr.findIndex((x) => x.id === id);
    if (i === -1) return false;
    arr.splice(i, 1);
    persist(col);
    return true;
  },
  replaceAll(col, docs) {
    CACHE[col] = docs;
    persist(col);
    return docs;
  },
};

// 首次运行播种：管理员账号 + 默认角色 + 默认租户
function seed() {
  if (db.all('users').length === 0) {
    const bcrypt = require('bcryptjs');
    db.insert('users', {
      id: db.uid('u_'),
      username: 'admin',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      tenantId: 't_default',
      displayName: '系统管理员',
      createdAt: new Date().toISOString(),
    });
  }
  if (db.all('roles').length === 0) {
    db.insert('roles', { id: 'r_admin', name: '管理员', perms: ['*'], createdAt: new Date().toISOString() });
    db.insert('roles', { id: 'r_editor', name: '编辑', perms: ['content:read', 'content:write'], createdAt: new Date().toISOString() });
    db.insert('roles', { id: 'r_user', name: '普通用户', perms: ['content:read'], createdAt: new Date().toISOString() });
  }
  if (db.all('tenants').length === 0) {
    db.insert('tenants', { id: 't_default', name: '默认租户', createdAt: new Date().toISOString() });
  }
  if (db.all('settings').length === 0) {
    db.insert('settings', {
      id: 'site',
      siteName: '个人工作台',
      brandColor: '#2b4c7e',
      allowRegister: true,
      updatedAt: new Date().toISOString(),
    });
  }
  if (db.all('contents').length === 0) {
    const now = new Date().toISOString();
    const demo = [
      {
        title: '欢迎使用个人工作台',
        summary: '一个本地优先、端到端加密的个人效率工具，现已打通 B 端管理与 C 端 App。',
        category: '公告',
        tags: ['产品', '更新'],
        status: 'published',
        body: '# 欢迎使用个人工作台\n\n这是一个**本地优先 + 端到端加密**的个人效率工具。\n\n## 三大能力\n\n- **工具效率**：任务、笔记、知识库、习惯打卡\n- **内容消费**：在「内容」里浏览运营发布的文章\n- **交易服务**：在「商城」体验下单流程骨架\n\n> 你的访问密码只在浏览器内用于加密，服务端只见密文。',
        publishedAt: now,
        updatedAt: now,
      },
      {
        title: '如何用看板规划你的一周',
        summary: '看板聚合待办、到期、逾期与习惯连续天数，配合近 7 日趋势，帮你掌控节奏。',
        category: '效率',
        tags: ['看板', '规划'],
        status: 'published',
        body: '# 用看板规划一周\n\n1. 打开**看板**，先看「今日到期」与「已逾期」\n2. 把大任务拆成可勾选的小任务\n3. 用习惯打卡保持连续天数\n\n```\n每日三件事：\n- 最重要的 1 件\n- 必须回复的消息\n- 30 分钟学习\n```\n\n[了解更多](https://example.com)',
        publishedAt: now,
        updatedAt: now,
      },
      {
        title: '笔记支持 Markdown 了',
        summary: '新建笔记可使用 # 标题、**加粗**、列表、链接等 Markdown 语法，并自动生成目录。',
        category: '效率',
        tags: ['笔记', 'Markdown'],
        status: 'published',
        body: '# Markdown 笔记\n\n支持：\n\n- **加粗** 与 *斜体*\n- 有序 / 无序列表\n- [超链接](https://example.com)\n- 代码块\n\n## 小技巧\n在「网页链接」里粘贴网址，会自动生成可点链接。',
        publishedAt: now,
        updatedAt: now,
      },
      {
        title: '云同步怎么用',
        summary: '在「我的」登录账号后开启云同步，加密数据可跨设备合并，不登录也能本地使用。',
        category: '帮助',
        tags: ['同步', '隐私'],
        status: 'published',
        body: '# 云同步说明\n\n1. 进入「我的 → 云端同步（账号）」\n2. 登录或注册账号\n3. 打开「启用云同步」开关\n\n数据仍用你的**访问密码**在浏览器内加密，账号仅作为传输凭证，隐私不泄露。',
        publishedAt: now,
        updatedAt: now,
      },
    ];
    demo.forEach((d) => db.insert('contents', Object.assign({ id: db.uid('c_') }, d)));
  }
}

module.exports = { db, seed };
