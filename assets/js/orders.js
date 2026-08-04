/* ===== 交易服务（C 端）：商品橱窗 → 购物车 → 结算(mock) → 我的订单 =====
   订单归属需登录账号（JWT）；未登录时引导去「我的」登录。支付为 mock（下单即视为已支付）。 */
(async function () {
  const esc = PBUI.esc;
  const cfg = PB.getConfig();
  PBUI.applyTheme(cfg.theme);
  PBUI.renderChrome('orders');

  const token = PB.getCloudToken();
  const cartKey = 'pwb_cart';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(cartKey) || '[]'); } catch (e) { cart = []; }
  let tab = 'shop';

  // 商品骨架（演示数据；真实场景可由 B 端内容/商品接口下发）
  const PRODUCTS = [
    { id: 'p1', title: '效率手账本', price: 39, emoji: '📒', desc: '周计划 + 习惯打卡页，纸质' },
    { id: 'p2', title: '专注计时器', price: 59, emoji: '⏱️', desc: '番茄钟实体版，续航 30 天' },
    { id: 'p3', title: '云同步会员(月)', price: 15, emoji: '☁️', desc: '跨设备加密同步权益' },
    { id: 'p4', title: '笔记模板包', price: 25, emoji: '📝', desc: '20 套 Markdown 实用模板' },
  ];
  const findP = (id) => PRODUCTS.find((p) => p.id === id);
  const cartCount = () => cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = () => cart.reduce((s, i) => s + (findP(i.id) ? findP(i.id).price * i.qty : 0), 0);
  const saveCart = () => localStorage.setItem(cartKey, JSON.stringify(cart));
  function addToCart(id) {
    const it = cart.find((x) => x.id === id);
    if (it) it.qty += 1; else cart.push({ id, qty: 1 });
    saveCart(); PBUI.toast('已加入购物车');
  }
  function setQty(id, q) {
    const it = cart.find((x) => x.id === id);
    if (!it) return;
    it.qty = q;
    if (it.qty <= 0) cart = cart.filter((x) => x.id !== id);
    saveCart();
  }

  if (!token) { renderLoginNeeded(); return; }

  function renderLoginNeeded() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-head"><h1>商城</h1></div>
      <div class="card center">
        <div style="font-size:46px;margin-bottom:8px;">🔒</div>
        <h3>交易服务需要登录账号</h3>
        <p class="muted-note">下单与「我的订单」会归属到你的账号。去「我的」登录或注册后即可使用。</p>
        <a class="btn btn-primary btn-block mt" href="profile.html">去「我的」登录</a>
      </div>`;
  }

  function segHTML() {
    const tabs = [['shop', '橱窗'], ['cart', '购物车' + (cartCount() ? `(${cartCount()})` : '')], ['orders', '我的订单']];
    return `<div class="seg">${tabs.map(([k, l]) => `<button class="seg-btn ${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>`;
  }

  function render() {
    const content = document.getElementById('content');
    const body = tab === 'shop' ? shopHTML() : tab === 'cart' ? cartHTML() : ordersHTML(null);
    content.innerHTML = `
      <div class="page-head"><h1>商城</h1><span class="muted-note">演示商店 · 支付为模拟</span></div>
      ${segHTML()}
      <div id="tab-body">${body}</div>`;
    content.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); if (tab === 'orders') loadOrders(); });
    bindTabBody();
  }

  function shopHTML() {
    return `<div class="prod-grid">${PRODUCTS.map(p => `
      <div class="prod-card">
        <div class="prod-emoji">${p.emoji}</div>
        <div class="prod-title">${esc(p.title)}</div>
        <div class="prod-desc">${esc(p.desc)}</div>
        <div class="prod-foot">
          <span class="prod-price">¥${p.price}</span>
          <button class="btn btn-sm btn-primary" data-add="${p.id}">加入</button>
        </div>
      </div>`).join('')}</div>`;
  }

  function cartHTML() {
    if (!cart.length) return `<div class="card center"><p class="muted-note">购物车是空的</p><button class="btn btn-primary mt" data-goshop>去逛逛</button></div>`;
    return `
      <div class="card">${cart.map(i => {
        const p = findP(i.id); if (!p) return '';
        return `<div class="cart-row">
          <div class="prod-emoji sm">${p.emoji}</div>
          <div class="cart-info"><div class="prod-title">${esc(p.title)}</div><div class="prod-price">¥${p.price}</div></div>
          <div class="cart-qty">
            <button class="qbtn" data-dec="${p.id}">−</button>
            <span>${i.qty}</span>
            <button class="qbtn" data-inc="${p.id}">＋</button>
          </div>
        </div>`;
      }).join('')}</div>
      <div class="card cart-summary">
        <div class="cfg-row"><label>合计</label><b style="font-size:20px;color:var(--primary)">¥${cartTotal()}</b></div>
        <button class="btn btn-primary btn-block" id="checkout">去结算（模拟支付）</button>
      </div>`;
  }

  function ordersHTML(list) {
    if (list === null) return `<div class="card center"><p class="muted-note">加载中…</p></div>`;
    if (!list.length) return `<div class="card center"><p class="muted-note">还没有订单</p></div>`;
    return `<div class="ord-list">${list.map(o => `
      <div class="ord-card">
        <div class="ord-head"><span class="muted-note">${esc(PBUI.fmtDate(o.createdAt))}</span><span class="badge ok">${o.status === 'paid' ? '已支付' : esc(o.status)}</span></div>
        ${o.items.map(it => `<div class="ord-item"><span>${esc(it.title || it.id)} ×${it.qty || 1}</span><span class="muted-note">¥${(it.price || 0) * (it.qty || 1)}</span></div>`).join('')}
        <div class="ord-foot"><span>合计</span><b>¥${o.total || 0}</b></div>
      </div>`).join('')}</div>`;
  }

  function bindTabBody() {
    const content = document.getElementById('content');
    content.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addToCart(b.dataset.add));
    const gs = content.querySelector('[data-goshop]'); if (gs) gs.onclick = () => { tab = 'shop'; render(); };
    content.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { setQty(b.dataset.inc, (cart.find(x => x.id === b.dataset.inc) || {}).qty + 1); render(); });
    content.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { setQty(b.dataset.dec, (cart.find(x => x.id === b.dataset.dec) || {}).qty - 1); render(); });
    const co = content.querySelector('#checkout');
    if (co) co.onclick = checkout;
  }

  async function checkout() {
    if (!cart.length) return;
    const items = cart.map(i => { const p = findP(i.id); return { id: p.id, title: p.title, price: p.price, qty: i.qty }; });
    const total = cartTotal();
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ items, total, note: '' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '下单失败');
      cart = []; saveCart();
      PBUI.toast('下单成功（模拟支付完成）', 'ok');
      tab = 'orders'; render(); loadOrders();
    } catch (e) { PBUI.toast(e.message, 'err'); }
  }

  async function loadOrders() {
    const body = document.getElementById('tab-body');
    try {
      const res = await fetch('/api/orders', { headers: { Authorization: 'Bearer ' + token } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '加载失败');
      if (body) body.innerHTML = ordersHTML(j.orders || []);
    } catch (e) {
      if (body) body.innerHTML = `<div class="card center"><p class="muted-note">${esc(e.message)}</p></div>`;
    }
  }

  render();
})();
