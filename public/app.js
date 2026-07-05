const MAX_ITEMS = 4;
let offerItems = [];
let targetItems = [];
let offerSearchItem = null;
let targetSearchItem = null;

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  checkConfig();
  setupItemSearch('offerSearch', 'offerResults', (item) => { offerSearchItem = item; document.getElementById('offerAddBtn').disabled = false; });
  setupItemSearch('targetSearch', 'targetResults', (item) => { targetSearchItem = item; document.getElementById('targetAddBtn').disabled = false; });
  setupItemsBrowser();
  loadPortfolio();

  document.getElementById('offerSearch').addEventListener('keydown', e => { if (e.key === 'Enter') addOfferItem(); });
  document.getElementById('targetSearch').addEventListener('keydown', e => { if (e.key === 'Enter') addTargetItem(); });

  renderChips('offerChips', offerItems, 'offer');
  renderChips('targetChips', targetItems, 'target');
  updateFindBtn();
});

async function checkConfig() {
  try {
    const res = await fetch('/api/config/status');
    const data = await res.json();
    const banner = document.getElementById('configBanner');
    if (data.configured) {
      banner.classList.add('configured');
      banner.innerHTML = '&#10003; Roblox cookie configured &mdash; owner lookup is active';
    }
  } catch {}
}

function showSetup() {
  document.getElementById('setupModal').classList.add('open');
}

function closeSetup() {
  document.getElementById('setupModal').classList.remove('open');
  checkConfig();
}

function setupTabs() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      const tab = document.getElementById('tab-' + link.dataset.tab);
      if (tab) tab.classList.add('active');
    });
  });
}

// ─── ITEM SEARCH (autocomplete) ─────────────────────
function setupItemSearch(inputId, resultsId, onSelect) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  const picker = input.closest('.trade-side') || input.parentElement;
  let debounce;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) { results.classList.remove('open'); return; }
    debounce = setTimeout(async () => {
      try {
        const res = await fetch('/api/items?search=' + encodeURIComponent(q) + '&sort=rap');
        const data = await res.json();
        results.innerHTML = data.items.slice(0, 10).map(item => `
          <div class="search-result-item" data-id="${item.id}">
            <div class="search-result-name">${item.name}</div>
            <div class="search-result-price">RAP: ${fmt(item.rap)} · Value: ${fmt(item.value)}</div>
          </div>
        `).join('');
        results.querySelectorAll('.search-result-item').forEach(el => {
          el.addEventListener('click', () => {
            const id = Number(el.dataset.id);
            const item = data.items.find(i => i.id === id);
            if (item) {
              onSelect(item);
              input.value = item.name;
              results.classList.remove('open');
            }
          });
        });
        results.classList.add('open');
      } catch {}
    }, 250);
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('open');
    }
  });
}

// ─── ADD / REMOVE ITEMS ────────────────────────────
function addOfferItem() {
  if (!offerSearchItem || offerItems.length >= MAX_ITEMS) return;
  offerItems.push(offerSearchItem);
  offerSearchItem = null;
  document.getElementById('offerSearch').value = '';
  document.getElementById('offerAddBtn').disabled = true;
  document.getElementById('offerResults').classList.remove('open');
  renderChips('offerChips', offerItems, 'offer');
  updateFindBtn();
}

function addTargetItem() {
  if (!targetSearchItem || targetItems.length >= MAX_ITEMS) return;
  targetItems.push(targetSearchItem);
  targetSearchItem = null;
  document.getElementById('targetSearch').value = '';
  document.getElementById('targetAddBtn').disabled = true;
  document.getElementById('targetResults').classList.remove('open');
  renderChips('targetChips', targetItems, 'target');
  updateFindBtn();
}

function removeOfferItem(index) {
  offerItems.splice(index, 1);
  renderChips('offerChips', offerItems, 'offer');
  updateFindBtn();
}

function removeTargetItem(index) {
  targetItems.splice(index, 1);
  renderChips('targetChips', targetItems, 'target');
  updateFindBtn();
}

function renderChips(containerId, items, side) {
  const container = document.getElementById(containerId);
  if (items.length === 0) {
    container.innerHTML = '<div class="chip-empty">No items selected</div>';
    return;
  }
  container.innerHTML = items.map((item, i) => `
    <div class="chip">
      <img src="" class="chip-img" data-id="${item.id}" onerror="this.style.display='none'">
      <span class="chip-name">${item.name}</span>
      <span style="font-size:0.75rem;color:var(--text2)">${fmt(item.rap)}</span>
      <button class="chip-remove" onclick="${side === 'offer' ? 'removeOfferItem' : 'removeTargetItem'}(${i})">&times;</button>
    </div>
  `).join('');

  for (const item of items) {
    const img = container.querySelector(`.chip-img[data-id="${item.id}"]`);
    if (img) loadThumb(item.id, img);
  }
}

async function loadThumb(itemId, imgEl) {
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${itemId}&format=Png&size=150x150`);
    if (res.ok) {
      const json = await res.json();
      if (json.data?.[0]?.imageUrl) imgEl.src = json.data[0].imageUrl;
    }
  } catch {}
}

function updateFindBtn() {
  const btn = document.getElementById('findOwnersBtn');
  btn.disabled = targetItems.length === 0;
}

// ─── FIND OWNERS ────────────────────────────────────
async function findOwners() {
  if (targetItems.length === 0) return;
  const btn = document.getElementById('findOwnersBtn');
  btn.textContent = 'Searching...';
  btn.disabled = true;

  const resultsDiv = document.getElementById('tradeResults');
  resultsDiv.style.display = 'block';
  document.getElementById('resultSummary').textContent = '';
  document.getElementById('ownerList').innerHTML = '<div class="loading">Looking up owners...</div>';

  try {
    const targetIds = targetItems.map(i => i.id).join(',');
    const offerIds = offerItems.map(i => i.id).join(',');
    const params = new URLSearchParams({ targetIds });
    if (offerIds) params.set('offerIds', offerIds);

    const res = await fetch('/api/trade/find?' + params.toString());
    const data = await res.json();

    const targetNames = data.targetItems.map(i => i.name).join(', ');
    document.getElementById('resultSummary').textContent = `of ${targetNames}`;

    document.getElementById('onlineBadge').textContent = `${data.onlineCount}/${data.totalOwners} online`;

    if (data.owners.length === 0) {
      document.getElementById('ownerList').innerHTML = `
        <div class="loading" style="line-height:1.6">
          No owners found for those items.<br>
          Make sure your Roblox cookie is set up (click the "Set up" link at the top).
        </div>`;
      btn.textContent = 'Find Trade Partners';
      btn.disabled = false;
      return;
    }

    document.getElementById('ownerList').innerHTML = data.owners.map(o => `
      <div class="owner-card">
        <div class="online-dot ${o.online ? 'online' : 'offline'}"></div>
        <div class="owner-info">
          <div class="owner-name">${o.username}</div>
          ${o.serial ? `<div class="owner-serial">Serial: ${o.serial}</div>` : ''}
        </div>
        <div class="owner-status">${presenceLabel(o.presenceType)}</div>
        <a href="${o.tradeUrl}" target="_blank" class="trade-link">Send Trade</a>
      </div>
    `).join('');

    data.owners.filter(o => o.online).slice(0, 20).forEach(o => {
      const img = new Image();
      img.src = `https://www.roblox.com/headshot-thumbnail/image?userId=${o.userId}&width=48&height=48&format=png`;
    });

  } catch (err) {
    document.getElementById('ownerList').innerHTML = `<div class="loading">Error: ${err.message}</div>`;
  }

  btn.textContent = 'Find Trade Partners';
  btn.disabled = false;
}

function presenceLabel(type) {
  return { 0: 'Offline', 1: 'Online', 2: 'In Game', 3: 'In Studio' }[type] || 'Unknown';
}

// ─── ITEMS BROWSER ──────────────────────────────────
function setupItemsBrowser() {
  const search = document.getElementById('itemSearch');
  const sort = document.getElementById('itemSort');
  const minRap = document.getElementById('minRap');
  const maxRap = document.getElementById('maxRap');
  let t;
  const load = () => { clearTimeout(t); t = setTimeout(loadItems, 250); };
  search.addEventListener('input', load);
  sort.addEventListener('change', loadItems);
  minRap.addEventListener('input', load);
  maxRap.addEventListener('input', load);
  loadItems();
}

async function loadItems() {
  const p = new URLSearchParams({ sort: document.getElementById('itemSort').value });
  const s = document.getElementById('itemSearch').value;
  if (s) p.set('search', s);
  if (document.getElementById('minRap').value) p.set('minRap', document.getElementById('minRap').value);
  if (document.getElementById('maxRap').value) p.set('maxRap', document.getElementById('maxRap').value);
  try {
    const res = await fetch('/api/items?' + p.toString());
    const data = await res.json();
    renderItemsTable(data.items);
  } catch {}
}

function renderItemsTable(items) {
  const c = document.getElementById('itemsTable');
  if (!items?.length) { c.innerHTML = '<div class="loading">No items found</div>'; return; }
  let html = '<table><thead><tr><th>Name</th><th>RAP</th><th>Value</th><th>Projected</th><th>Trend</th><th>Demand</th></tr></thead><tbody>';
  for (const item of items) {
    const sp = item.value - item.rap;
    html += `<tr>
      <td>${item.name}</td>
      <td>${fmt(item.rap)}</td>
      <td><span class="tag ${sp > 0 ? 'tag-green' : sp < 0 ? 'tag-red' : ''}">${fmt(item.value)}</span></td>
      <td>${fmt(item.projected)}</td>
      <td>${trendTag(item.trend)}</td>
      <td>${demandTag(item.demand)}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  c.innerHTML = html;
}

// ─── PORTFOLIO ─────────────────────────────────────
async function loadPortfolio() {
  try {
    const res = await fetch('/api/portfolio');
    const data = await res.json();
    const c = document.getElementById('portfolioTable');
    if (!data.items?.length) { c.innerHTML = '<div class="loading">No items in portfolio.</div>'; return; }
    const ir = await fetch('/api/items?sort=rap');
    const id = await ir.json();
    const m = {}; for (const i of id.items) m[i.id] = i;
    let tp = 0, tv = 0, h = '<table><thead><tr><th>Item</th><th>Qty</th><th>Paid</th><th>RAP</th><th>Value</th><th>P&L</th><th></th></tr></thead><tbody>';
    for (let i = 0; i < data.items.length; i++) {
      const p = data.items[i], item = m[p.itemId];
      const n = item ? item.name : '#' + p.itemId, rap = item ? item.rap : 0;
      const cst = p.purchasePrice * p.quantity, val = rap * p.quantity, pl = val - cst;
      tp += cst; tv += val;
      h += `<tr><td>${n}</td><td>${p.quantity}</td><td>${fmt(cst)}</td><td>${fmt(rap)}</td><td>${fmt(val)}</td><td><span class="tag ${pl >= 0 ? 'tag-green' : 'tag-red'}">${pl >= 0 ? '+' : ''}${fmt(pl)}</span></td><td><button class="chip-remove" onclick="removePf(${i})">&times;</button></td></tr>`;
    }
    const tpl = tv - tp;
    h += `<tr style="font-weight:700;border-top:2px solid var(--border)"><td>Total</td><td></td><td>${fmt(tp)}</td><td></td><td>${fmt(tv)}</td><td><span class="tag ${tpl >= 0 ? 'tag-green' : 'tag-red'}">${tpl >= 0 ? '+' : ''}${fmt(tpl)}</span></td><td></td></tr></tbody></table>`;
    c.innerHTML = h;
  } catch {}
}

async function addPortfolioItem() {
  const id = document.getElementById('pfItemId').value, pr = document.getElementById('pfPrice').value, q = document.getElementById('pfQty').value || 1;
  if (!id || !pr) return;
  await fetch('/api/portfolio/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: Number(id), purchasePrice: Number(pr), quantity: Number(q) }) });
  document.getElementById('pfItemId').value = ''; document.getElementById('pfPrice').value = '';
  loadPortfolio();
}

async function removePortfolioItem(i) {
  await fetch('/api/portfolio/' + i, { method: 'DELETE' });
  loadPortfolio();
}
window.removePf = removePortfolioItem;

// ─── UTILS ─────────────────────────────────────────
function fmt(n) {
  if (!n || n === 0) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return n.toLocaleString();
  return n.toString();
}

function trendTag(t) {
  if (t === 'Rising' || t === 'Rapidly Rising') return '<span class="tag tag-green">' + t + '</span>';
  if (t === 'Stable') return '<span class="tag tag-blue">Stable</span>';
  if (t === 'Declining') return '<span class="tag tag-red">Declining</span>';
  return '<span class="tag tag-yellow">' + t + '</span>';
}

function demandTag(d) {
  if (!d || d === 'Unknown') return '<span class="tag tag-yellow">—</span>';
  if (d === 'High' || d === 'Amazing') return '<span class="tag tag-green">' + d + '</span>';
  if (d === 'Low' || d === 'Terrible') return '<span class="tag tag-red">' + d + '</span>';
  return '<span class="tag tag-blue">' + d + '</span>';
}
