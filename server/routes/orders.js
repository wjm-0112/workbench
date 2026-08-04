/**
 * 交易服务（C 端）：下单 / 我的订单 / 模拟支付。骨架版，支付为 mock。
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

// 创建订单（mock 结算）
router.post('/', authenticate, (req, res) => {
  const { items, total, note } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: '购物车为空' });
  const order = {
    id: db.uid('o_'),
    userId: req.user.uid,
    items,
    total: total || items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0),
    note: note || '',
    status: 'paid', // mock：直接视为已支付
    paidAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  db.insert('orders', order);
  res.json({ order });
});

// 我的订单
router.get('/', authenticate, (req, res) => {
  const list = db
    .filter('orders', (o) => o.userId === req.user.uid)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json({ orders: list });
});

// 订单详情
router.get('/:id', authenticate, (req, res) => {
  const o = db.find('orders', (x) => x.id === req.params.id && x.userId === req.user.uid);
  if (!o) return res.status(404).json({ error: '订单不存在' });
  res.json({ order: o });
});

module.exports = router;
