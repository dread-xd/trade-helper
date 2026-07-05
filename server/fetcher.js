import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAllItems, computeFlippingOpportunities } from './api/rolimons.js';
import { getThumbnails } from './api/roblox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

let cachedItems = [];
let cachedFlips = [];
let lastFetch = 0;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadCache() {
  ensureDataDir();
  if (fs.existsSync(ITEMS_FILE)) {
    try {
      const raw = fs.readFileSync(ITEMS_FILE, 'utf-8');
      cachedItems = JSON.parse(raw);
      cachedFlips = computeFlippingOpportunities(cachedItems);
    } catch {}
  }
}

function saveCache(items) {
  ensureDataDir();
  fs.writeFileSync(ITEMS_FILE, JSON.stringify(items), 'utf-8');
}

function loadHistory() {
  ensureDataDir();
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    } catch { return {} };
  }
  return {};
}

function saveHistory(history) {
  ensureDataDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history), 'utf-8');
}

async function ensureThumbnails(items) {
  const missing = items.filter(i => !i.thumbnail);
  if (missing.length === 0) return;
  const ids = missing.map(i => i.id);
  const thumbnails = await getThumbnails(ids);
  for (const item of items) {
    if (thumbnails[item.id]) {
      item.thumbnail = thumbnails[item.id];
    }
  }
}

export async function fetchItems(force = false) {
  const now = Date.now();
  if (!force && cachedItems.length > 0 && (now - lastFetch) < 60000) {
    return { items: cachedItems, flips: cachedFlips };
  }

  try {
    const items = await fetchAllItems();
    cachedItems = items;
    cachedFlips = computeFlippingOpportunities(items);
    lastFetch = now;

    saveCache(items);

    try {
      await ensureThumbnails(items);
      saveCache(items);
    } catch {}

    const history = loadHistory();
    const timestamp = new Date().toISOString().slice(0, 16);
    for (const item of items.slice(0, 500)) {
      if (!history[item.id]) history[item.id] = [];
      const last = history[item.id][history[item.id].length - 1];
      if (!last || last[1] !== item.rap) {
        history[item.id].push([timestamp, item.rap]);
        if (history[item.id].length > 200) history[item.id].shift();
      }
    }
    saveHistory(history);

    return { items, flips: cachedFlips };
  } catch (err) {
    if (cachedItems.length > 0) {
      return { items: cachedItems, flips: cachedFlips };
    }
    throw err;
  }
}

export function getPriceHistory(itemId) {
  const history = loadHistory();
  return history[itemId] || [];
}

export function getCachedItems() {
  if (cachedItems.length === 0) loadCache();
  return { items: cachedItems, flips: cachedFlips };
}

loadCache();
