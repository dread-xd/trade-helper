import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRouter } from './server.js';
import { fetchItems } from './fetcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', createRouter(express));

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function start() {
  console.log('Fetching item data from Rolimons...');
  try {
    await fetchItems(true);
    console.log('Item data loaded');
  } catch (err) {
    console.warn('Initial fetch failed (will retry on first request):', err.message);
  }

  setInterval(async () => {
    try {
      await fetchItems(true);
    } catch {}
  }, 5 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`Roblox Trade Bot running at http://localhost:${PORT}`);
  });
}

start();
