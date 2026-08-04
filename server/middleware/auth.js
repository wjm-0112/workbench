/**
 * JWT 鉴权中间件
 * - authenticate: 校验 Bearer token，挂载 req.user
 * - requireRole:  限制角色（如 'admin'）
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pwb-dev-secret-change-me';
const TOKEN_TTL = '7d';

function sign(user) {
  return jwt.sign({ uid: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

function authenticate(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '未登录' });
    // 未指定角色则仅校验登录态；指定角色时，匹配角色或管理员均放行
    if (role && req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

module.exports = { sign, authenticate, requireRole, JWT_SECRET };
