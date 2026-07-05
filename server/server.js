import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchItems, getPriceHistory } from './fetcher.js';
import { getItemOwners, checkPresence, getTradeUrl, getThumbnails } from './api/roblox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const PORTFOLIO_FILE = path.join(DATA_DIR, 'portfolio.json');

function loadPortfolio() {
  if (fs.existsSync(PORTFOLIO_FILE)) {
    try { return JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf-8')); } catch {}
  }
  return { items: [] };
}

function savePortfolio(p) {
  fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(p, null, 2), 'utf-8');
}

export function createRouter(express) {
  const router = express.Router();

  router.get('/items', async (req, res) => {
    try {
      const data = await fetchItems(req.query.force === 'true');
      let filtered = data.items;
      if (req.query.search) {
        const q = req.query.search.toLowerCase();
        filtered = filtered.filter(i =>
          i.name.toLowerCase().includes(q) || i.acronym.toLowerCase().includes(q)
        );
      }
      if (req.query.minRap) filtered = filtered.filter(i => i.rap >= Number(req.query.minRap));
      if (req.query.maxRap) filtered = filtered.filter(i => i.rap <= Number(req.query.maxRap));
      const sort = req.query.sort || 'name';
      if (sort === 'rap') filtered.sort((a, b) => b.rap - a.rap);
      else if (sort === 'value') filtered.sort((a, b) => b.value - a.value);
      else filtered.sort((a, b) => a.name.localeCompare(b.name));
      res.json({ items: filtered, total: filtered.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/items/:id', async (req, res) => {
    try {
      const { items } = await fetchItems();
      const item = items.find(i => i.id === Number(req.params.id));
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const history = getPriceHistory(item.id);
      res.json({ item, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/trade/find', async (req, res) => {
    const targetIds = (req.query.targetIds || '').split(',').map(Number).filter(Boolean);
    const offerIds = (req.query.offerIds || '').split(',').map(Number).filter(Boolean);
    if (targetIds.length === 0) return res.status(400).json({ error: 'At least one target item required' });

    try {
      const { items } = await fetchItems();
      const targetItems = targetIds.map(id => items.find(i => i.id === id)).filter(Boolean);
      const offerItems = offerIds.map(id => items.find(i => i.id === id)).filter(Boolean);

      const ownersPerItem = await Promise.all(targetIds.map(id => getItemOwners(id)));

      let commonOwners = [];
      if (ownersPerItem.length === 1) {
        commonOwners = ownersPerItem[0];
      } else {
        const userSets = ownersPerItem.map(owners => new Set(owners.map(o => o.userId)));
        const intersection = new Set([...userSets[0]].filter(userId =>
          userSets.every(set => set.has(userId))
        ));
        const ownerMap = new Map();
        for (const owners of ownersPerItem) {
          for (const o of owners) {
            if (intersection.has(o.userId)) {
              ownerMap.set(o.userId, o);
            }
          }
        }
        commonOwners = [...ownerMap.values()];
      }

      const userIds = commonOwners.map(o => o.userId);
      const presence = userIds.length > 0 ? await checkPresence(userIds) : {};

      const ownersWithStatus = commonOwners.map(o => ({
        ...o,
        online: presence[o.userId]?.online || false,
        presenceType: presence[o.userId]?.presenceType || 0,
        tradeUrl: getTradeUrl(o.userId),
      }));

      const online = ownersWithStatus.filter(o => o.online);
      const offline = ownersWithStatus.filter(o => !o.online);

      let thumbnails = {};
      const thumbIds = [...targetIds, ...offerIds];
      try { if (thumbIds.length > 0) thumbnails = await getThumbnails(thumbIds); } catch {}

      res.json({
        targetItems,
        offerItems,
        owners: [...online, ...offline],
        totalOwners: commonOwners.length,
        onlineCount: online.length,
        thumbnails,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/portfolio', (req, res) => {
    res.json(loadPortfolio());
  });

  router.post('/portfolio/add', express.json(), (req, res) => {
    const { itemId, purchasePrice, quantity } = req.body;
    if (!itemId || !purchasePrice) return res.status(400).json({ error: 'itemId and purchasePrice required' });
    const portfolio = loadPortfolio();
    portfolio.items.push({
      itemId: Number(itemId), purchasePrice: Number(purchasePrice),
      quantity: Number(quantity) || 1, addedAt: new Date().toISOString(),
    });
    savePortfolio(portfolio);
    res.json(portfolio);
  });

  router.delete('/portfolio/:index', (req, res) => {
    const portfolio = loadPortfolio();
    const idx = Number(req.params.index);
    if (idx >= 0 && idx < portfolio.items.length) portfolio.items.splice(idx, 1);
    savePortfolio(portfolio);
    res.json(portfolio);
  });

  router.get('/stats', async (req, res) => {
    try {
      const data = await fetchItems();
      const withRap = data.items.filter(i => i.rap > 0);
      res.json({
        totalItems: data.items.length,
        trackedItems: withRap.length,
        totalRap: withRap.reduce((s, i) => s + i.rap, 0),
        avgRap: withRap.length > 0 ? Math.round(withRap.reduce((s, i) => s + i.rap, 0) / withRap.length) : 0,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/config/status', (req, res) => {
    const hasCookie = fs.existsSync(path.join(__dirname, 'data', 'config.json'));
    if (hasCookie) {
      try {
        const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'config.json'), 'utf-8'));
        res.json({ configured: !!c['.ROBLOSECURITY'] });
      } catch { res.json({ configured: false }); }
    } else {
      res.json({ configured: false });
    }
  });

  router.post('/refresh', async (req, res) => {
    try {
      const data = await fetchItems(true);
      res.json({ success: true, count: data.items.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
