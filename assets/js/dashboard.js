let weekChart = null, statusChart = null;

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return '早上好呀';
  if (h < 18) return '下午好呀';
  return '晚上好呀';
}
function last7() {
  const arr = [], d = new Date();
  for (let i = 6; i >= 0; i--) {
    const x = new Date(d); x.setDate(d.getDate() - i);
    arr.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
  }
  return arr;
}
function streak(set) {
  let s = 0; const d = new Date();
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (set.has(key)) { s++; d.setDate(d.getDate() - 1); } else break;
  }
  return s;
}

function renderDashboard() {
  const d = PB.getData();
  const today = PBUI.todayStr();
  document.getElementById('greet').textContent = greeting();

  const notDone = d.tasks.filter(t => t.status !== 'done');
  const dueToday = notDone.filter(t => t.due === today);
  const overdue = notDone.filter(t => t.due && t.due < today);
  const maxStreak = Math.max(0, ...d.habits.map(h => streak(new Set(h.checkins))));
  document.getElementById('stats').innerHTML = `
    <div class="stat"><div class="label">待办总数</div><div class="num">${notDone.length}</div></div>
    <div class="stat"><div class="label">今日到期</div><div class="num">${dueToday.length}</div></div>
    <div class="stat"><div class="label">最长连续打卡</div><div class="num">${maxStreak} 天</div></div>`;

  const showTasks = notDone.slice().sort((a, b) => new Date(a.due || '9999') - new Date(b.due || '9999')).slice(0, 6);
  const tl = document.getElementById('today-list');
  if (!showTasks.length) tl.innerHTML = PBUI.emptyHint('今天没有待办，真棒！');
  else tl.innerHTML = showTasks.map(t => {
    const ov = t.due && t.due < today;
    const dot = t.status === 'doing' ? 'dot-doing' : 'dot-todo';
    return `<div class="item" style="margin-bottom:8px"><div class="row"><span class="title">${PBUI.esc(t.title)}</span><span class="dot ${dot}"></span></div>${t.due ? `<div class="meta" style="${ov ? 'color:var(--accent)' : ''}">${PBUI.esc(t.due)}${ov ? ' (逾期)' : ''}</div>` : ''}</div>`;
  }).join('');

  const rn = d.notes.slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, 6);
  const nl = document.getElementById('notes-list');
  if (!rn.length) nl.innerHTML = PBUI.emptyHint('还没有笔记');
  else nl.innerHTML = rn.map(n => `<div class="item" style="margin-bottom:8px"><div class="row"><span class="title">${PBUI.esc(n.title)}</span><span class="meta">${PBUI.fmtDate(n.updatedAt)}</span></div></div>`).join('');

  const hl = document.getElementById('habit-list');
  if (!d.habits.length) hl.innerHTML = PBUI.emptyHint('添加个习惯开始打卡吧');
  else {
    const days = last7();
    hl.innerHTML = d.habits.map(h => {
      const set = new Set(h.checkins);
      const cells = days.map(day => `<div class="habit-cell ${set.has(day) ? 'on' : ''}" data-hid="${h.id}" data-day="${day}">${new Date(day).getDate()}</div>`).join('');
      return `<div class="habit-row"><div><b>${PBUI.esc(h.name)}</b> <span class="muted">· 连续 ${streak(set)} 天</span></div><button class="btn btn-sm btn-accent" data-hdel="${h.id}">删</button></div><div class="habit-grid" style="margin-bottom:10px">${cells}</div>`;
    }).join('');
    hl.querySelectorAll('.habit-cell').forEach(c => c.onclick = () => toggleHabit(c.dataset.hid, c.dataset.day));
    hl.querySelectorAll('[data-hdel]').forEach(b => b.onclick = () => delHabit(b.dataset.hdel));
  }

  renderCharts(d, last7());
}

function toggleHabit(id, day) {
  const d = PB.getData();
  const h = d.habits.find(x => x.id === id); if (!h) return;
  const i = h.checkins.indexOf(day);
  if (i >= 0) h.checkins.splice(i, 1); else h.checkins.push(day);
  PBUI.touch(h); PB.save(); renderDashboard();
}
function delHabit(id) {
  if (!confirm('删除这个习惯？')) return;
  const d = PB.getData();
  d.habits = d.habits.filter(x => x.id !== id);
  PB.save(); renderDashboard();
}
function addHabit() {
  PBUI.openModal(`<h2>添加习惯</h2><div class="field"><label>习惯名称</label><input type="text" id="hname" placeholder="如：喝水 / 读书 / 运动"></div><div class="toolbar"><button class="btn btn-primary" id="hok">添加</button><button class="btn btn-ghost" id="hcancel">取消</button></div>`);
  document.getElementById('hcancel').onclick = PBUI.closeModal;
  document.getElementById('hok').onclick = () => {
    const name = document.getElementById('hname').value.trim();
    if (!name) { PBUI.toast('名称不能为空'); return; }
    const d = PB.getData();
    d.habits.push(PBUI.touch({ id: PB.uid(), name, checkins: [] }));
    PB.save(); PBUI.closeModal(); renderDashboard(); PBUI.toast('已添加');
  };
}

function renderCharts(d, days) {
  if (!window.Chart) return;
  const week = days.map(day => d.tasks.filter(t => t.status === 'done' && (t.updatedAt || '').slice(0, 10) === day).length);
  const ctxW = document.getElementById('chart-week');
  if (weekChart) weekChart.destroy();
  weekChart = new Chart(ctxW, {
    type: 'bar',
    data: { labels: days.map(x => x.slice(5)), datasets: [{ label: '完成数', data: week, backgroundColor: '#4DA3FF', borderColor: '#3A3A3A', borderWidth: 2, borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
  const c = {
    todo: d.tasks.filter(t => t.status === 'todo').length,
    doing: d.tasks.filter(t => t.status === 'doing').length,
    done: d.tasks.filter(t => t.status === 'done').length
  };
  const ctxS = document.getElementById('chart-status');
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(ctxS, {
    type: 'doughnut',
    data: { labels: ['待办', '进行中', '完成'], datasets: [{ data: [c.todo, c.doing, c.done], backgroundColor: ['#4DA3FF', '#FFD23F', '#5CCB5C'], borderColor: '#3A3A3A', borderWidth: 2 }] },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  PBUI.renderChrome('dashboard');
  const ok = await PBUI.ensureUnlocked();
  if (!ok) return;
  await PBUI.afterUnlockSync();
  document.getElementById('add-habit').onclick = addHabit;
  renderDashboard();
});
