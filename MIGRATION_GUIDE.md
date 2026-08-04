# 个人工作台 · 换机迁移与部署指南（v2.0，双端 + 后端）

本包用于把「个人工作台」整套代码、文档与（可选的）数据搬到另一台电脑，并重新部署。

---

## 一、这个包里有什么

- **C 端（手机 App）全部源代码**：`index.html`、`content.html`、`tasks.html`、`notes.html`、`snippets.html`、`orders.html`、`profile.html`，以及 `assets/`（样式 + 脚本）。
- **B 端（管理系统）源代码**：`admin/`（login.html、index.html、assets）。
- **后端服务**：`server/`（`index.js`、`db.js`、`routes/`、`middleware/`、`package.json`）。
- **PWA / 资源**：`sw.js`、`manifest.webmanifest`、`icon.svg`。
- **文档**：`README.md`、`PRD.md`、`技术栈文档.md`、本指南。
- **`.git/`**：git 版本历史（方便在新电脑继续用 git 管理）。

> ❌ 不包含 `.workbuddy/`：那是 AI 助手的工作记忆（私人目录），与你的网站无关，且已被 `.gitignore` 忽略，不会进公开仓库。

---

## 二、⚠️ 最重要：代码包 ≠ 你的数据

你的 **C 端任务/笔记/知识库/访问密码/主题色/模块配置** 默认加密存放在**你当前浏览器的 localStorage** 里（整体加密成一个 blob），也**可能已上传到后端 `sync/blob`**（若开启了账号云同步）。它们**不在这堆文件里**。

所以：
- 只拷贝代码 → 换机后打开是「空工作台」，需重新设密码（或登录账号拉取同步）。
- 要把**数据**一起搬走，请用下面任一方式备份/恢复。

**方式 A：账号云同步（推荐，最省事）**
1. 旧设备「我的」页 → 云端同步（账号）→ 登录并启用云同步（数据已加密上传后端）。
2. 新设备打开同一地址、登录**同一账号** + 输**同一密码** → 自动拉取同步，即得回全部数据。

**方式 B：导出 / 导入备份**
1. 旧设备「我的」页 → 导出备份 → 得到 `个人工作台备份.json`（**明文**，请自行妥善保管）。
2. 新设备「我的」页 → 导入备份 → 选该文件（会覆盖当前数据并刷新配置）。

**方式 C：后端数据目录（含账号/内容/订单）**
- 后端数据在 `server/data/*.json`。整体拷贝该目录到新机器同路径，即可保留账号、已发布内容、订单等。

---

## 三、新电脑部署步骤

### 1. 解压 / 拉取代码
把本包解压到任意目录（例如 `D:\workbench`），或 `git clone` 到新机器。

### 2. 启动后端（B 端 + 同步/内容/商城所需）
```
cd server
npm install          # 仅首次：安装 express jsonwebtoken bcryptjs
npm start            # 监听 http://localhost:3000
```
- 首次启动自动播种：管理员 `admin/admin123`、默认角色/租户、站点配置、4 篇演示内容。
- 若从旧机器迁移，先把旧 `server/data/` 拷到此处再启动（见方式 C）。

### 3. 本地预览 C 端（先验证能跑）
进到解压目录，地址栏输入 `cmd` 回车，执行：
```
python -m http.server 8000
```
浏览器打开 `http://localhost:8000`（C 端）与 `http://localhost:8000/admin/login.html`（B 端）。

> ⚠️ **不能直接双击 `index.html` 打开**：`file://` 协议下浏览器会禁用加密，密码门进不去。`localhost` 被视为安全环境，加密可用。

### 4. 部署上线（电脑 / 手机都能用）
- **C 端静态文件**：把根目录的 html + `assets/` + `manifest.webmanifest` + `sw.js` + `icon.svg` 托管到任意静态服务（GitHub Pages / Vercel / Nginx / 对象存储）。
- **后端服务**：把 `server/` 部署为 Node 服务（同机或独立），确保 C 端能访问其 `/api/*`。C 端默认连 `http://localhost:3000`，上线时在 `assets/js/store.js` 调整同步基地址即可。
- **B 端**：随静态文件托管 `/admin`；接口走同一后端。
- 手机浏览器打开 C 端地址 → 「添加到主屏幕」→ 起个名字，像 App 一样用（PWA，断网也能开）。

---

## 四、从 v1（GitHub 同步版）迁移到 v2（账号云同步）

v1 用 GitHub 仓库存加密 `data.json`，v2 改为**后端账号 + `sync/blob`**，不再需要 GitHub PAT。

- **已在 v1 用 GitHub 同步过的数据**：在 v1 环境「我的」页先**导出备份**（明文 JSON），再到 v2 环境「我的」页**导入备份**，即可平移数据；随后登录 v2 账号开启云同步。
- v2 已移除 GitHub 同步 UI 与 `syncPull/syncPush`，改为 `cloudPush/cloudPull`；访问密码与加密格式（v2）保持兼容，旧 v1 密文仍可解密。
- 后端源码目录（`server/`）被静态托管守卫（404），不会泄漏到公网。

---

## 五、安全提醒

- 后端默认管理员 `admin/admin123` 仅用于演示，**上线前务必修改密码**（B 端用户管理或「我的」）。
- 账号密码用 bcrypt 哈希存储；C 端访问密码只在浏览器内用于加/解密，**从不上传**。
- 后端 `server/data/` 含全部账号与业务数据，请纳入常规备份，并避免公网直接暴露该目录。
- 任何在聊天里明文出现过的令牌/密码，建议到对应平台作废并重新生成。

---

## 六、常见问题

- **Q：打开后提示"打不开 / 加密被禁用"？**
  A：用了双击打开（`file://`）。请按「三-3」用 `python -m http.server` 起本地服务，访问 `http://localhost:8000`。

- **Q：内容/商城/云同步用不了？**
  A：这些依赖后端。请按「三-2」先 `cd server && npm install && npm start`，再访问 C 端。

- **Q：换机后数据为空？**
  A：数据不在代码包里。按「二」用账号云同步、导出/导入、或拷贝 `server/data/` 恢复。

- **Q：线上看到的是旧样式？**
  A：旧 Service Worker 缓存。关掉标签页重开一次，或清一下该站点的 Service Worker 即可加载新版。

- **Q：B 端登录不上？**
  A：确认后端已启动（`http://localhost:3000/api/health` 返回 ok）；用播种账号 `admin/admin123`，或先在「我的」注册（若 `allowRegister` 开启）。
