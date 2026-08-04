# 个人工作台 · 换机迁移与部署指南（纯前端 v2.2）

本包用于把「个人工作台」整套代码、文档与（可选的）数据搬到另一台电脑，并重新部署。

---

## 一、这个包里有什么

- **C 端（手机 App）全部源代码**：`index.html`、`planner.html`、`snippets.html`、`finance.html`、`profile.html`、`settings.html`，以及 `assets/`（样式 + 脚本）。
- **B 端（管理控制台）源代码**：`admin/`（login.html、index.html、assets）。
- **PWA / 资源**：`sw.js`、`manifest.webmanifest`、`icon.svg`、`.nojekyll`。
- **文档**：`README.md`、`PRD.md`、`技术栈文档.md`、本指南。
- **`.git/`**：git 版本历史（方便在新电脑继续用 git 管理）。

> ❌ 不包含 `.workbuddy/`：那是 AI 助手的工作记忆（私人目录），与你的网站无关，且已被 `.gitignore` 忽略，不会进公开仓库。
> ❌ 无 `server/` 后端目录：v2.1 为纯前端，已移除 Node 后端、内容发布与交易模块。

---

## 二、⚠️ 最重要：代码包 ≠ 你的数据

你的 **C 端任务/笔记/知识库/访问密码/主题色/模块配置** 默认加密存放在**你当前浏览器的 localStorage** 里（整体加密成一个 blob），也**可能已上传到你的 GitHub 仓库**（若开启了云同步）。它们**不在这堆文件里**。

所以：
- 只拷贝代码 → 换机后打开是「空工作台」，需重新设密码（或登录同一 GitHub 仓库拉取同步）。
- 要把**数据**一起搬走，请用下面任一方式备份/恢复。

**方式 A：GitHub 云端同步（推荐，最省事）**
1. 旧设备「我的」页 → 云端同步（GitHub）→ 填写 PAT + 仓库并「上传（推送）」（加密 blob 已推到仓库）。
2. 新设备打开同一地址、填写**同一 PAT + 仓库** + 输**同一访问密码** → 「下载（拉取）」自动合并，即得回全部数据。

**方式 B：导出 / 导入备份**
1. 旧设备「我的」页（或管理台「数据管理」）→ 导出备份 → 得到 `个人工作台备份.json`（**明文**，请自行妥善保管）。
2. 新设备「我的」页 → 导入备份 → 选该文件（会覆盖当前数据并刷新配置）。

---

## 三、新电脑部署步骤

### 1. 解压 / 拉取代码
把本包解压到任意目录（例如 `D:\workbench`），或 `git clone` 到新机器。

### 2. 本地预览 C 端（先验证能跑）
进到解压目录，地址栏输入 `cmd` 回车，执行：
```
python -m http.server 8000
```
浏览器打开 `http://localhost:8000`（C 端）与 `http://localhost:8000/admin/login.html`（管理台）。

> ⚠️ **不能直接双击 `index.html` 打开**：`file://` 协议下浏览器会禁用加密，密码门进不去。`localhost` 被视为安全环境，加密可用。

### 3. 部署上线（电脑 / 手机都能用）
- **C 端静态文件**：把根目录的 html + `assets/` + `manifest.webmanifest` + `sw.js` + `icon.svg` + `admin/` 托管到任意静态服务（GitHub Pages / Vercel / Nginx / 对象存储）。
- **无需任何服务器进程**：云同步由浏览器直连 GitHub，不依赖自有后端。
- 手机浏览器打开 C 端地址 → 「添加到主屏幕」→ 起个名字，像 App 一样用（PWA，断网也能开）。

#### 推送到 GitHub 并开启 Pages（示例）
1. 在本机终端进入项目目录，先推送（本仓库已配好 `origin`）：
   ```bash
   git push -u origin master
   ```
2. 打开 `https://github.com/wjm-0112/workbench` → **Settings → Pages** → Source 选 **Deploy from a branch** → Branch 选 **master** / 目录 **/ (root)** → Save。
3. 约 1 分钟后，手机浏览器打开 `https://wjm-0112.github.io/workbench/` → 菜单「添加到主屏幕」即可当 App 用。
   （仓库已含 `.nojekyll`，确保带 `_` 的文件不被 Jekyll 忽略。）

---

## 四、从 v2.0（后端账号版）迁移到 v2.1（纯前端 GitHub 同步版）

v2.0 用后端账号 + `sync/blob` 做云同步；v2.1 移除后端，改为**纯前端 + 用户自己的 GitHub 仓库**存储加密 blob。

- **已在 v2.0 用账号同步过的数据**：在 v2.0 环境「我的」页先**导出备份**（明文 JSON），再到 v2.1 环境「我的」页**导入备份**，即可平移数据；随后在 v2.1 配置 GitHub 云同步。
- **已移除模块**：v2.0 的「内容发布」「交易服务（商城）」与 `server/` 后端在 v2.1 中已删除；旧加密 blob 中的这两个模块会在加载时被模块白名单过滤丢弃（不影响其余数据）。
- v2.1 沿用同一访问密码与加密格式（v2），旧密文仍可解密；GitHub 仓库只存密文。

---

## 五、安全提醒

- 访问密码只在浏览器内用于加/解密，**从不上传**；GitHub 仓库只存密文。
- PAT 仅作 GitHub API 传输凭证，建议用**细粒度令牌（Fine-grained）**且仅授权目标仓库的 **Contents: Read and write**；本地不持久化明文 PAT。
- 任何在聊天里明文出现过的令牌/密码，建议到对应平台作废并重新生成。

---

## 六、常见问题

- **Q：打开后提示"打不开 / 加密被禁用"？**
  A：用了双击打开（`file://`）。请按「三-2」用 `python -m http.server` 起本地服务，访问 `http://localhost:8000`。

- **Q：云同步用不了？**
  A：检查 PAT 是否有目标仓库的 Contents 读写权限、owner/repo/path 是否填对，先点「测试连接」；并确保浏览器能联网访问 `api.github.com`。

- **Q：换机后数据为空？**
  A：数据不在代码包里。按「二」用 GitHub 云同步或导出/导入恢复。

- **Q：线上看到的是旧样式？**
  A：旧 Service Worker 缓存。关掉标签页重开一次，或清一下该站点的 Service Worker 即可加载新版（缓存版本已升到 `pwb-v4`）。

- **Q：管理台登录不上？**
  A：管理台与 C 端共用同一访问密码，请用 C 端设置的那个密码；首次在管理台打开即设置密码。
