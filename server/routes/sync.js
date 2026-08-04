/**
 * C 端云同步：个人数据以「客户端加密后的整体 blob」形式存服务端。
 * 服务端只存密文，密钥（用户密码）不离开浏览器 —— 兼顾后端云同步与隐私。
 * 也保留「纯本地模式」（不登录）由前端 localStorage 处理，本路由仅在登录后使用。
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

// 拉取当前用户的同步 blob
router.get('/blob', authenticate, (req, res) => {
  const rec = db.find('sync', (s) => s.userId === req.user.uid);
  if (!rec) return res.status(204).end();
  res.json({ blob: rec.blob, updatedAt: rec.updatedAt });
});

// 推送（覆盖）当前用户的同步 blob
router.put('/blob', authenticate, (req, res) => {
  const { blob } = req.body || {};
  if (typeof blob !== 'string' || !blob) return res.status(400).json({ error: 'blob 不能为空' });
  const existing = db.find('sync', (s) => s.userId === req.user.uid);
  const now = new Date().toISOString();
  if (existing) {
    db.update('sync', existing.id, { blob, updatedAt: now });
  } else {
    db.insert('sync', { id: db.uid('s_'), userId: req.user.uid, blob, updatedAt: now });
  }
  res.json({ ok: true, updatedAt: now });
});

module.exports = router;
