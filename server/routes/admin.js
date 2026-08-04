/**
 * B 端管理后台 API（仅管理员）
 * 模块：数据看板(stats) / 内容管理 / 用户权限租户 / 运营配置 / 审计 / 健康
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('admin'));

function audit(action, user) {
  db.insert('audit', {
    id: db.uid('a_'),
    action,
    by: user.username,
    at: new Date().toISOString(),
  });
}

// ---------- 数据看板 ----------
router.get('/stats', (req, res) => {
  const users = db.all('users');
  const contents = db.all('contents');
  const orders = db.all('orders');
  const today = new Date().toISOString().slice(0, 10);
  const newUsersToday = users.filter((u) => (u.createdAt || '').slice(0, 10) === today).length;
  const revenueToday = orders
    .filter((o) => (o.createdAt || '').slice(0, 10) === today)
    .reduce((s, o) => s + (o.total || 0), 0);
  const byStatus = contents.reduce((m, c) => {
    m[c.status || 'draft'] = (m[c.status || 'draft'] || 0) + 1;
    return m;
  }, {});
  // 近 7 日新增用户趋势
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    trend.push({ date: d, users: users.filter((u) => (u.createdAt || '').slice(0, 10) === d).length });
  }
  res.json({
    totalUsers: users.length,
    totalContents: contents.length,
    totalOrders: orders.length,
    newUsersToday,
    revenueToday,
    contentByStatus: byStatus,
    trend,
  });
});

// ---------- 内容管理 ----------
router.get('/contents', (req, res) => {
  const items = db.all('contents').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  res.json({ items });
});

router.post('/contents', (req, res) => {
  const { title, body, category, tags, status, summary } = req.body || {};
  if (!title) return res.status(400).json({ error: '标题必填' });
  const c = db.insert('contents', {
    id: db.uid('c_'),
    title,
    summary: summary || '',
    body: body || '',
    category: category || '未分类',
    tags: tags || [],
    status: status || 'draft',
    publishedAt: status === 'published' ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  });
  audit(`创建内容 ${title}`, req.user);
  res.json({ content: c });
});

router.put('/contents/:id', (req, res) => {
  const patch = { ...req.body, updatedAt: new Date().toISOString() };
  if (patch.status === 'published' && !req.body.publishedAt) patch.publishedAt = new Date().toISOString();
  const c = db.update('contents', req.params.id, patch);
  if (!c) return res.status(404).json({ error: '内容不存在' });
  audit(`更新内容 ${c.title}`, req.user);
  res.json({ content: c });
});

router.delete('/contents/:id', (req, res) => {
  const ok = db.remove('contents', req.params.id);
  if (!ok) return res.status(404).json({ error: '内容不存在' });
  audit(`删除内容 ${req.params.id}`, req.user);
  res.json({ ok: true });
});

// ---------- 用户管理 ----------
router.get('/users', (req, res) => {
  const list = db.all('users').map((u) => ({
    id: u.id, username: u.username, displayName: u.displayName, role: u.role, tenantId: u.tenantId, createdAt: u.createdAt,
  }));
  res.json({ users: list });
});

router.post('/users', (req, res) => {
  const { username, password, displayName, role, tenantId } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
  if (db.find('users', (u) => u.username === username)) return res.status(409).json({ error: '用户名已存在' });
  const bcrypt = require('bcryptjs');
  const u = db.insert('users', {
    id: db.uid('u_'),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    displayName: displayName || username,
    role: role || 'user',
    tenantId: tenantId || 't_default',
    createdAt: new Date().toISOString(),
  });
  audit(`创建用户 ${username}`, req.user);
  res.json({ user: { id: u.id, username: u.username, role: u.role } });
});

router.put('/users/:id', (req, res) => {
  const { displayName, role, tenantId } = req.body || {};
  const u = db.update('users', req.params.id, { displayName, role, tenantId });
  if (!u) return res.status(404).json({ error: '用户不存在' });
  audit(`更新用户 ${u.username}`, req.user);
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.user.uid) return res.status(400).json({ error: '不能删除自己' });
  const ok = db.remove('users', req.params.id);
  if (!ok) return res.status(404).json({ error: '用户不存在' });
  audit(`删除用户 ${req.params.id}`, req.user);
  res.json({ ok: true });
});

// ---------- 角色 ----------
router.get('/roles', (req, res) => res.json({ roles: db.all('roles') }));
router.post('/roles', (req, res) => {
  const { name, perms } = req.body || {};
  if (!name) return res.status(400).json({ error: '角色名必填' });
  const r = db.insert('roles', { id: db.uid('r_'), name, perms: perms || [], createdAt: new Date().toISOString() });
  res.json({ role: r });
});
router.put('/roles/:id', (req, res) => {
  const r = db.update('roles', req.params.id, req.body || {});
  if (!r) return res.status(404).json({ error: '角色不存在' });
  res.json({ ok: true });
});
router.delete('/roles/:id', (req, res) => {
  const ok = db.remove('roles', req.params.id);
  if (!ok) return res.status(404).json({ error: '角色不存在' });
  res.json({ ok: true });
});

// ---------- 租户 ----------
router.get('/tenants', (req, res) => res.json({ tenants: db.all('tenants') }));
router.post('/tenants', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: '租户名必填' });
  const t = db.insert('tenants', { id: db.uid('t_'), name, createdAt: new Date().toISOString() });
  res.json({ tenant: t });
});
router.put('/tenants/:id', (req, res) => {
  const t = db.update('tenants', req.params.id, req.body || {});
  if (!t) return res.status(404).json({ error: '租户不存在' });
  res.json({ ok: true });
});
router.delete('/tenants/:id', (req, res) => {
  const ok = db.remove('tenants', req.params.id);
  if (!ok) return res.status(404).json({ error: '租户不存在' });
  res.json({ ok: true });
});

// ---------- 站点配置 ----------
router.get('/settings', (req, res) => {
  const s = db.find('settings', (x) => x.id === 'site') || {};
  res.json({ settings: s });
});
router.put('/settings', (req, res) => {
  const s = db.update('settings', 'site', { ...req.body, updatedAt: new Date().toISOString() });
  audit('更新站点配置', req.user);
  res.json({ settings: s });
});

// ---------- 审计 ----------
router.get('/audit', (req, res) => {
  const list = db.all('audit').sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 100);
  res.json({ audit: list });
});

// ---------- 健康 ----------
router.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime(), time: new Date().toISOString() }));

module.exports = router;
