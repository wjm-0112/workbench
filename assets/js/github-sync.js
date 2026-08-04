/* ===== 个人工作台 · GitHub 云同步（纯前端，零后端） =====
 * 用 GitHub Personal Access Token 把「已端到端加密」的 blob 存到仓库文件。
 * 数据本身由 PB 用访问密码 AES-GCM 加密，这里只负责传输；令牌(PAT) 仅作凭证。
 * 接口：GitHub Contents API（支持浏览器 CORS；已认证速率 5000/hr）。
 */
const GitHubSync = (function () {
  const API = 'https://api.github.com';

  function authHeader(pat) {
    return { 'Authorization': 'Bearer ' + pat, 'Accept': 'application/vnd.github+json' };
  }
  function repoApi(owner, repo, path) {
    return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
  }

  // 上传：PUT /repos/{o}/{r}/contents/{path}
  // body: { message, content(base64), sha? }；无 sha 视为首次创建
  async function githubPush({ pat, owner, repo, path, b64, sha }) {
    const res = await fetch(repoApi(owner, repo, path), {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader(pat)),
      body: JSON.stringify({ message: 'pwb sync ' + new Date().toISOString(), content: b64, sha: sha || undefined })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('令牌无效或无权限');
      if (res.status === 403) throw new Error('权限不足或被限流（检查 PAT 范围）');
      throw new Error(e.message || ('上传失败 ' + res.status));
    }
    const j = await res.json();
    return { sha: j.content && j.content.sha };
  }

  // 下载：GET 同路径；404 → 远端尚无数据
  async function githubPull({ pat, owner, repo, path }) {
    const res = await fetch(repoApi(owner, repo, path), { headers: authHeader(pat) });
    if (res.status === 404) return { missing: true };
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('令牌无效或无权限');
      if (res.status === 403) throw new Error('权限不足或被限流（检查 PAT 范围）');
      throw new Error(e.message || ('下载失败 ' + res.status));
    }
    const j = await res.json();
    if (!j.content) throw new Error('返回格式异常');
    return { b64: j.content.replace(/\s/g, ''), sha: j.sha };
  }

  // 连接测试：读取仓库元数据，验证令牌与仓库可读性
  async function testConnection({ pat, owner, repo }) {
    const res = await fetch(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers: authHeader(pat) });
    if (res.status === 401) throw new Error('令牌无效或无权限');
    if (res.status === 403) throw new Error('权限不足或被限流（检查 PAT 范围）');
    if (res.status === 404) throw new Error('仓库不存在或无访问权限');
    if (!res.ok) throw new Error('连接失败 ' + res.status);
    const j = await res.json();
    return { name: j.full_name, defaultBranch: j.default_branch };
  }

  return { githubPush, githubPull, testConnection };
})();
