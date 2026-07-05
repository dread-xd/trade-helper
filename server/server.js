import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchItems, getPriceHistory, getCachedItems } from './fetcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const PORTFOLIO_FILE = path.join(DATA_DIR, 'portfolio.json');

function loadPortfolio() {
  if (fs.existsSync(PORTFOLIO_FILE)) {
    try { return JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf-8')); } catch {}
  }
  return { items: [] };
}

function savePortfolio(portfolio) {
  fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(portfolio, null, 2), 'utf-8');
}

export function createRouter(express) {
  const router = express.Router();

  router.get('/items', async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const data = await fetchItems(force);
      const items = data.items;
      let filtered = items;

      if (req.query.search) {
        const q = req.query.search.toLowerCase();
        filtered = items.filter(i =>
          i.name.toLowerCase().includes(q) ||
          i.acronym.toLowerCase().includes(q)
        );
      }

      if (req.query.minRap) filtered = filtered.filter(i => i.rap >= Number(req.query.minRap));
      if (req.query.maxRap) filtered = filtered.filter(i => i.rap <= Number(req.query.maxRap));
      if (req.query.trend) filtered = filtered.filter(i => i.trend === req.query.trend);
      if (req.query.demand) filtered = filtered.filter(i => i.demand === req.query.demand);

      const sort = req.query.sort || 'name';
      if (sort === 'rap') filtered.sort((a, b) => b.rap - a.rap);
      else if (sort === 'value') filtered.sort((a, b) => b.value - a.value);
      else if (sort === 'projected') filtered.sort((a, b) => b.projected - a.projected);
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

  router.get('/flips', async (req, res) => {
    try {
      const data = await fetchItems();
      res.json({ flips: data.flips.slice(0, 50) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/portfolio', (req, res) => {
    const portfolio = loadPortfolio();
    res.json(portfolio);
  });

  router.post('/portfolio/add', express.json(), (req, res) => {
    const { itemId, purchasePrice, quantity } = req.body;
    if (!itemId || !purchasePrice) {
      return res.status(400).json({ error: 'itemId and purchasePrice required' });
    }
    const portfolio = loadPortfolio();
    portfolio.items.push({
      itemId: Number(itemId),
      purchasePrice: Number(purchasePrice),
      quantity: Number(quantity) || 1,
      addedAt: new Date().toISOString(),
    });
    savePortfolio(portfolio);
    res.json(portfolio);
  });

  router.delete('/portfolio/:index', (req, res) => {
    const portfolio = loadPortfolio();
    const idx = Number(req.params.index);
    if (idx >= 0 && idx < portfolio.items.length) {
      portfolio.items.splice(idx, 1);
      savePortfolio(portfolio);
    }
    res.json(portfolio);
  });

  router.get('/stats', async (req, res) => {
    try {
      const data = await fetchItems();
      const items = data.items;
      const withRap = items.filter(i => i.rap > 0);
      const totalValue = withRap.reduce((s, i) => s + i.value, 0);
      const totalRap = withRap.reduce((s, i) => s + i.rap, 0);
      const bestFlips = data.flips.slice(0, 5);

      res.json({
        totalItems: items.length,
        trackedItems: withRap.length,
        totalValue,
        totalRap,
        avgRap: withRap.length > 0 ? Math.round(totalRap / withRap.length) : 0,
        bestFlips,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/refresh', async (req, res) => {
    try {
      const data = await fetchItems(true);
      res.json({ success: true, count: data.items.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
