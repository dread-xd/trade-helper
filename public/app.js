let allItems = [];
let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupSearch();
  setupPortfolio();
  setupModal();
  document.getElementById('refreshBtn').addEventListener('click', refreshData);
  loadDashboard();
});

function setupTabs() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      const tab = document.getElementById('tab-' + link.dataset.tab);
      if (tab) tab.classList.add('active');
      if (link.dataset.tab === 'items') loadItems();
      if (link.dataset.tab === 'flips') loadFlips();
      if (link.dataset.tab === 'dashboard') loadDashboard();
    });
  });
}

function setupSearch() {
  const searchInput = document.getElementById('itemSearch');
  const sortSelect = document.getElementById('itemSort');
  const minRap = document.getElementById('minRap');
  const maxRap = document.getElementById('maxRap');
  let debounce;
  const reload = () => {
    clearTimeout(debounce);
    debounce = setTimeout(loadItems, 300);
  };
  searchInput.addEventListener('input', reload);
  sortSelect.addEventListener('change', loadItems);
  minRap.addEventListener('input', reload);
  maxRap.addEventListener('input', reload);
}

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function refreshData() {
  document.getElementById('refreshBtn').textContent = 'Loading...';
  document.getElementById('refreshBtn').disabled = true;
  try {
    await api('/api/refresh');
    await loadDashboard();
    document.getElementById('refreshBtn').textContent = 'Done!';
    setTimeout(() => {
      document.getElementById('refreshBtn').textContent = 'Refresh';
      document.getElementById('refreshBtn').disabled = false;
    }, 1500);
  } catch (err) {
    document.getElementById('refreshBtn').textContent = 'Failed';
    setTimeout(() => {
      document.getElementById('refreshBtn').textContent = 'Refresh';
      document.getElementById('refreshBtn').disabled = false;
    }, 2000);
  }
}

async function loadDashboard() {
  try {
    const [stats, flips] = await Promise.all([
      api('/api/stats'),
      api('/api/flips'),
    ]);
    document.getElementById('statItems').textContent = stats.trackedItems?.toLocaleString() || '0';
    document.getElementById('statAvgRap').textContent = stats.avgRap ? stats.avgRap.toLocaleString() : '0';
    document.getElementById('statTotalValue').textContent = stats.totalValue ? stats.totalValue.toLocaleString() : '0';
    document.getElementById('statTotalRap').textContent = stats.totalRap ? stats.totalRap.toLocaleString() : '0';

    renderFlipsTable('dashboardFlips', flips.flips.slice(0, 5));
    loadTrending();
  } catch (err) {
    document.querySelectorAll('#statsRow .stat-value').forEach(el => el.textContent = 'Error');
  }
}

async function loadTrending() {
  try {
    const data = await api('/api/items?sort=rap&maxRap=50000');
    const trending = data.items
      .filter(i => i.rap > 100)
      .sort((a, b) => Math.abs(b.trend === 'Rising' ? b.rap : 0) - Math.abs(a.trend === 'Rising' ? a.rap : 0))
      .slice(0, 10);
    renderItemsTable('dashboardTrending', trending);
  } catch {}
}

async function loadItems() {
  const search = document.getElementById('itemSearch').value;
  const sort = document.getElementById('itemSort').value;
  const minRap = document.getElementById('minRap').value;
  const maxRap = document.getElementById('maxRap').value;
  try {
    const params = new URLSearchParams({ sort });
    if (search) params.set('search', search);
    if (minRap) params.set('minRap', minRap);
    if (maxRap) params.set('maxRap', maxRap);
    const data = await api('/api/items?' + params.toString());
    renderItemsTable('itemsTable', data.items);
  } catch (err) {
    document.getElementById('itemsTable').innerHTML = `<div class="loading">Error: ${err.message}</div>`;
  }
}

async function loadFlips() {
  try {
    const data = await api('/api/flips');
    renderFlipsTable('flipsTable', data.flips);
  } catch (err) {
    document.getElementById('flipsTable').innerHTML = `<div class="loading">Error: ${err.message}</div>`;
  }
}

function trendTag(trend) {
  if (trend === 'Rising') return '<span class="tag tag-green">Rising</span>';
  if (trend === 'Stable' || trend === 'Stable-ish') return '<span class="tag tag-blue">Stable</span>';
  if (trend === 'Declining') return '<span class="tag tag-red">Declining</span>';
  return `<span class="tag tag-yellow">${trend || 'Unknown'}</span>`;
}

function demandTag(demand) {
  if (!demand) return '<span class="tag tag-yellow">—</span>';
  const d = demand.toLowerCase();
  if (d === 'high' || d === 'amazing') return `<span class="tag tag-green">${demand}</span>`;
  if (d === 'low' || d === 'terrible') return `<span class="tag tag-red">${demand}</span>`;
  return `<span class="tag tag-blue">${demand}</span>`;
}

function formatNumber(n) {
  if (!n || n === 0) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return n.toLocaleString();
  return n.toString();
}

function renderItemsTable(containerId, items) {
  const container = document.getElementById(containerId);
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="loading">No items found</div>';
    return;
  }
  let html = '<table><thead><tr><th>Name</th><th>RAP</th><th>Value</th><th>Spread</th><th>Projected</th><th>Trend</th><th>Demand</th></tr></thead><tbody>';
  for (const item of items) {
    const spread = item.value - item.rap;
    const spreadClass = spread > 0 ? 'tag-green' : spread < 0 ? 'tag-red' : '';
    html += `<tr>
      <td onclick="showItemDetail(${item.id})">${item.name}</td>
      <td>${formatNumber(item.rap)}</td>
      <td>${formatNumber(item.value)}</td>
      <td><span class="tag ${spreadClass}">${spread > 0 ? '+' : ''}${formatNumber(spread)}</span></td>
      <td>${formatNumber(item.projected)}</td>
      <td>${trendTag(item.trend)}</td>
      <td>${demandTag(item.demand)}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderFlipsTable(containerId, flips) {
  const container = document.getElementById(containerId);
  if (!flips || flips.length === 0) {
    container.innerHTML = '<div class="loading">No flip opportunities found</div>';
    return;
  }
  let html = '<table><thead><tr><th>Name</th><th>RAP</th><th>Value</th><th>Spread</th><th>Spread %</th><th>Trend</th><th>Demand</th></tr></thead><tbody>';
  for (const f of flips) {
    html += `<tr>
      <td onclick="showItemDetail(${f.id})">${f.name}</td>
      <td>${formatNumber(f.rap)}</td>
      <td>${formatNumber(f.value)}</td>
      <td><span class="tag tag-green">+${formatNumber(f.spread)}</span></td>
      <td><span class="tag tag-green">+${f.spreadPercent}%</span></td>
      <td>${trendTag(f.trend)}</td>
      <td>${demandTag(f.demand)}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function showItemDetail(itemId) {
  const overlay = document.getElementById('itemModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  title.textContent = 'Loading...';
  body.innerHTML = '<div class="loading">Loading...</div>';
  overlay.classList.add('open');

  try {
    const data = await api(`/api/items/${itemId}`);
    const item = data.item;
    title.textContent = item.name;

    const spread = item.value - item.rap;
    const spreadPercent = item.rap > 0 ? ((spread / item.rap) * 100).toFixed(1) : '0';

    body.innerHTML = `
      <div class="item-detail-grid">
        <div class="detail-field"><div class="detail-label">Item ID</div><div class="detail-value">${item.id}</div></div>
        <div class="detail-field"><div class="detail-label">Acronym</div><div class="detail-value">${item.acronym || '—'}</div></div>
        <div class="detail-field"><div class="detail-label">RAP</div><div class="detail-value">${formatNumber(item.rap)}</div></div>
        <div class="detail-field"><div class="detail-label">Value</div><div class="detail-value">${formatNumber(item.value)}</div></div>
        <div class="detail-field"><div class="detail-label">Spread</div><div class="detail-value" style="color:${spread > 0 ? 'var(--green)' : spread < 0 ? 'var(--red)' : 'inherit'}">${spread > 0 ? '+' : ''}${formatNumber(spread)} (${spread > 0 ? '+' : ''}${spreadPercent}%)</div></div>
        <div class="detail-field"><div class="detail-label">Projected</div><div class="detail-value">${formatNumber(item.projected)}</div></div>
        <div class="detail-field"><div class="detail-label">Trend</div><div class="detail-value">${trendTag(item.trend)}</div></div>
        <div class="detail-field"><div class="detail-label">Demand</div><div class="detail-value">${demandTag(item.demand)}</div></div>
      </div>
      <div class="chart-container">
        <canvas id="priceChart"></canvas>
      </div>
    `;

    if (data.history && data.history.length > 1) {
      renderChart(data.history);
    }
  } catch (err) {
    title.textContent = 'Error';
    body.innerHTML = `<div class="loading">${err.message}</div>`;
  }
}

function renderChart(history) {
  const canvas = document.getElementById('priceChart');
  if (!canvas) return;
  if (chartInstance) chartInstance.destroy();

  const labels = history.map(h => h[0].slice(5, 16));
  const prices = history.map(h => h[1]);

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'RAP',
        data: prices,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#8888a0', maxTicksLimit: 10, font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: '#8888a0', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

function setupModal() {
  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('itemModal').classList.remove('open');
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  });
  document.getElementById('itemModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      document.getElementById('itemModal').classList.remove('open');
      if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    }
  });
}

async function setupPortfolio() {
  loadPortfolio();
  document.getElementById('pfAddBtn').addEventListener('click', addPortfolioItem);
}

async function loadPortfolio() {
  try {
    const data = await api('/api/portfolio');
    const container = document.getElementById('portfolioTable');
    if (!data.items || data.items.length === 0) {
      container.innerHTML = '<div class="loading">No items in portfolio. Add some above.</div>';
      return;
    }
    const [itemsData] = await Promise.all([api('/api/items?sort=rap')]);
    const itemMap = {};
    for (const item of itemsData.items) itemMap[item.id] = item;

    let totalPaid = 0;
    let totalValue = 0;
    let html = '<table><thead><tr><th>Item</th><th>Qty</th><th>Paid</th><th>Current RAP</th><th>Value</th><th>P&L</th><th></th></tr></thead><tbody>';
    for (let i = 0; i < data.items.length; i++) {
      const p = data.items[i];
      const item = itemMap[p.itemId];
      const name = item ? item.name : `#${p.itemId}`;
      const currentRap = item ? item.rap : 0;
      const cost = p.purchasePrice * p.quantity;
      const value = currentRap * p.quantity;
      const pl = value - cost;
      const plClass = pl >= 0 ? 'tag-green' : 'tag-red';
      totalPaid += cost;
      totalValue += value;

      html += `<tr>
        <td>${name}</td>
        <td>${p.quantity}</td>
        <td>${formatNumber(cost)}</td>
        <td>${formatNumber(currentRap)}</td>
        <td>${formatNumber(value)}</td>
        <td><span class="tag ${plClass}">${pl >= 0 ? '+' : ''}${formatNumber(pl)}</span></td>
        <td><button class="btn-icon" onclick="removePortfolioItem(${i})">&times;</button></td>
      </tr>`;
    }
    const totalPl = totalValue - totalPaid;
    html += `<tr style="font-weight:700;border-top:2px solid var(--border)">
      <td>Total</td><td></td><td>${formatNumber(totalPaid)}</td><td></td>
      <td>${formatNumber(totalValue)}</td>
      <td><span class="tag ${totalPl >= 0 ? 'tag-green' : 'tag-red'}">${totalPl >= 0 ? '+' : ''}${formatNumber(totalPl)}</span></td>
      <td></td>
    </tr>`;
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    document.getElementById('portfolioTable').innerHTML = `<div class="loading">Error: ${err.message}</div>`;
  }
}

async function addPortfolioItem() {
  const itemId = document.getElementById('pfItemId').value;
  const price = document.getElementById('pfPrice').value;
  const qty = document.getElementById('pfQty').value || 1;
  if (!itemId || !price) return;
  try {
    await fetch('/api/portfolio/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: Number(itemId), purchasePrice: Number(price), quantity: Number(qty) }),
    });
    document.getElementById('pfItemId').value = '';
    document.getElementById('pfPrice').value = '';
    document.getElementById('pfQty').value = '1';
    await loadPortfolio();
  } catch (err) {
    alert('Failed to add: ' + err.message);
  }
}

async function removePortfolioItem(index) {
  await fetch(`/api/portfolio/${index}`, { method: 'DELETE' });
  await loadPortfolio();
}
