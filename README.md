# 个人工作台 · 使用说明（小白版）

一个**本地优先、跨设备、隐私安全**的个人网站，包含四大模块：任务待办、笔记资料、数据看板、技术速查。数据用你的密码加密后存在本地，可选同步到 GitHub 私有仓库。

---

## 一、这是什么

| 模块 | 能干什么 |
|---|---|
| 看板 | 一屏总览：今日任务、最近笔记、习惯打卡、小图表 |
| 任务 | 增/删/改/查，设截止日、状态、标签，搜索 |
| 笔记 | 写 Markdown 笔记，加标签和网页链接，全文搜索 |
| 速查 | 存代码片 / API / 命令，一键复制，搜索 |
| 设置 | 改密码、配 GitHub 同步、导出/导入备份 |

---

## 二、怎么打开（两种方式）

> ⚠️ 因为浏览器安全限制，直接双击 html 文件打开时，加密功能会被禁用。请用下面任一方式。

### 方式 A：本地看（推荐先试）
1. 在这个文件夹里，地址栏输入 `cmd` 回车（Windows）。
2. 输入：`python -m http.server 8000` 回车。
3. 浏览器打开 `http://localhost:8000`。
4. 不用了就在那个黑窗口按 `Ctrl+C` 关掉。

> 没装 Python？百度“Windows 安装 Python”，一步步装好即可（勾选 “Add to PATH”）。

### 方式 B：部署到 GitHub Pages（电脑手机都能用，免费）

> 部署上去的是**网站代码**（已帮你准备好，本地仓库已建好）。你的笔记/任务在上传前会被密码加密，所以即使仓库公开也看不到明文。

**第 1 步：注册 GitHub（免费）**
- 打开 https://github.com ，点 Sign up，用邮箱注册一个账号。

**第 2 步：新建一个仓库（放网站代码）**
- 登录后点右上角「+」→ New repository。
- Repository name 填：`workbench`（或你喜欢的英文名，只能英文/数字/横线）。
- 选 **Public**（免费账号只能公开仓库；你的数据是加密的，安全）。
- 不要勾 “Add a README”，其它默认，点 Create repository。
- 建好后页面会显示一个网址，形如 `https://github.com/你的用户名/workbench.git`，先留着。

**第 3 步：生成访问令牌（PAT，用来让你/我推送代码）**
- 打开 https://github.com/settings/tokens （或 头像 → Settings → Developer settings → Personal access tokens → Tokens (classic)）。
- 点 Generate new token (classic)，Note 填 `workbench-deploy`，Expiration 选 `No expiration`（或 90 天）。
- 勾选 `repo`（整项打勾即可）。
- 最下面点 Generate token。
- **重要：生成后那串 `ghp_...` 只显示一次，立刻复制保存好。**

**第 4 步：把代码推上去（二选一）**

- 方式 1（让我帮你推）：把第 3 步复制的 `ghp_...` 令牌发给我，我执行推送并帮你开启 Pages。令牌仅用于这一次推送命令，不会写入任何文件。
- 方式 2（自己推，用 GitHub Desktop 最省事）：
  1. 下载安装 GitHub Desktop（https://desktop.github.com）。
  2. File → Add Local Repository，选中本文件夹。
  3. 左上角 Publish repository，Remote 选你刚建的 `workbench`，点 Publish。
  4. 之后每次改了东西，写个说明点 Push 即可。

**第 5 步：开启 Pages**
- 在 GitHub 打开你的仓库 → Settings → Pages。
- Source 选 **Deploy from a branch**，Branch 选 **main**，文件夹选 **/ (root)**，点 Save。
- 等 1～2 分钟，页面会显示你的网址：`https://你的用户名.github.io/workbench/`。
- 电脑浏览器打开它，设密码即可用。

**第 6 步：手机上像 App 一样用**
- 手机浏览器（Safari / Chrome）打开上面的 Pages 网址。
- 点浏览器「分享 / ⋯」菜单 → **「添加到主屏幕」** → 起个名字（如“工作台”）。
- 桌面就多了一个图标，点开是全屏、断网也能开（PWA）。

> 电脑和手机要**数据互通**，请再按下面「四、数据同步」在设置页配置同一个 GitHub 同步（同一个账号下的另一个私有仓库存加密数据）。只部署不配同步也能用，只是各自设备数据独立。

---

## 三、第一次使用

1. 打开后**设一个访问密码**（用来加密你的数据）。
2. 请务必牢记这个密码——**忘记无法恢复**（加密数据打不开）。
3. 之后每次打开输入密码解锁即可。

---

## 四、数据同步（可选）

1. 打开「设置」页。
2. 勾选“启用云同步”，填 GitHub 用户名、仓库名、访问令牌（PAT）。
3. 点「测试同步」：成功就说明通了，之后改动会自动加密上传。
4. 另一台设备打开同一地址、输同一密码，就会自动拉取同步。

> 不配 GitHub 也能正常用「本地版」，数据存在当前浏览器里。

---

## 五、备份（强烈建议）

- 设置页点「导出备份」，会得到一份 `个人工作台备份.json`。
- 换设备/重装前，先导出一份保存好。
- 需要恢复时点「导入备份」选这个文件即可。

---

## 六、隐私说明

- 你的数据用**密码 AES 加密**后存储，密码不会离开你的浏览器。
- GitHub 令牌只存在你本机浏览器，仅用于读写你自己的仓库。
- 即使仓库被看到，没有密码也解不开密文。

---

## 七、文件结构（以后想自己改也看得懂）

```
index.html      看板首页
tasks.html      任务
notes.html      笔记
snippets.html   速查
settings.html   设置
assets/css/style.css   样式（颜色/字体都在这里）
assets/js/store.js     数据+加密+同步
assets/js/common.js    密码门/导航/蜡笔涂鸦装饰
assets/js/*.js         各页面逻辑
```
改文字、改颜色，基本都在 `style.css` 和各个 html 里。
