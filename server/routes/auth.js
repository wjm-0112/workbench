/**
 * 鉴权路由：注册 / 登录 / 个人信息 / 改密 / 登出
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { sign, authenticate } = require('../middleware/auth');

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  const user = db.find('users', (u) => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  res.json({
    token: sign(user),
    user: publicUser(user),
  });
});

// 注册（受站点配置 allowRegister 控制）
router.post('/register', (req, res) => {
  const settings = db.find('settings', (s) => s.id === 'site') || { allowRegister: true };
  if (!settings.allowRegister) return res.status(403).json({ error: '当前已关闭注册' });
  const { username, password, displayName } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  if (db.find('users', (u) => u.username === username)) {
    return res.status(409).json({ error: '用户名已存在' });
  }
  const user = db.insert('users', {
    id: db.uid('u_'),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'user',
    tenantId: 't_default',
    displayName: displayName || username,
    createdAt: new Date().toISOString(),
  });
  res.json({ token: sign(user), user: publicUser(user) });
});

// 个人信息
router.get('/me', authenticate, (req, res) => {
  const user = db.find('users', (u) => u.id === req.user.uid);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user: publicUser(user) });
});

// 改密
router.post('/change-password', authenticate, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const user = db.find('users', (u) => u.id === req.user.uid);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (!bcrypt.compareSync(oldPassword || '', user.passwordHash)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  db.update('users', user.id, { passwordHash: user.passwordHash });
  res.json({ ok: true });
});

// 登出（无状态 JWT，前端丢弃 token 即可；此处仅作约定端点）
router.post('/logout', authenticate, (req, res) => res.json({ ok: true }));

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    tenantId: u.tenantId,
    createdAt: u.createdAt,
  };
}

module.exports = router;
