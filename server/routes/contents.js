/**
 * 内容消费（C 端）：读取已发布内容，用于「内容消费」模块（浏览/搜索/收藏）。
 * 写操作在 admin.js 中（仅管理员）。
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');

function listPublished({ q, category, page = 1, pageSize = 20 } = {}) {
  let items = db.filter('contents', (c) => c.status === 'published');
  if (category) items = items.filter((c) => c.category === category);
  if (q) {
    const k = q.toLowerCase();
    items = items.filter(
      (c) =>
        (c.title || '').toLowerCase().includes(k) ||
        (c.body || '').toLowerCase().includes(k) ||
        (c.tags || []).join(',').toLowerCase().includes(k)
    );
  }
  items.sort((a, b) => (b.publishedAt || b.updatedAt || '').localeCompare(a.publishedAt || a.updatedAt || ''));
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { total, page: Number(page), pageSize: Number(pageSize), items: items.slice(start, start + Number(pageSize)) };
}

// 列表（支持搜索/分类/分页）
router.get('/', (req, res) => {
  const { q, category, page, pageSize } = req.query;
  res.json(listPublished({ q, category, page, pageSize }));
});

// 分类枚举
router.get('/categories', (req, res) => {
  const cats = [...new Set(db.filter('contents', (c) => c.status === 'published').map((c) => c.category).filter(Boolean))];
  res.json({ categories: cats });
});

// 详情
router.get('/:id', (req, res) => {
  const c = db.find('contents', (x) => x.id === req.params.id && x.status === 'published');
  if (!c) return res.status(404).json({ error: '内容不存在' });
  res.json({ content: c });
});

module.exports = router;
