/**
 * 个人工作台 · 后端入口
 * - REST API：/api/auth, /api/sync, /api/contents, /api/orders, /api/admin
 * - 静态托管：C 端（项目根目录）+ B 端（/admin 目录），同源部署避免 CORS
 */
const express = require('express');
const path = require('path');
const { db, seed } = require('./db');

seed();

const app = express();
app.use(express.json({ limit: '5mb' }));

// ---- 路由 ----
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/contents', require('./routes/contents'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

// 健康检查（无需鉴权，便于监控）
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ---- 避免泄露服务端源码/依赖 ----
app.use((req, res, next) => {
  if (req.path.startsWith('/server') || req.path.startsWith('/node_modules') || req.path.startsWith('/.git')) {
    return res.status(404).end();
  }
  next();
});

// ---- 静态前端 ----
const ROOT = path.join(__dirname, '..');
const ADMIN = path.join(ROOT, 'admin');
app.use('/admin', express.static(ADMIN));
app.use(express.static(ROOT));

// ---- 启动 ----
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ 个人工作台后端已启动: http://localhost:${PORT}`);
    console.log(`   C 端:      http://localhost:${PORT}/`);
    console.log(`   B 端后台:  http://localhost:${PORT}/admin/  (admin / admin123)`);
  });
}

module.exports = app;
