import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');

const THUMBNAIL_API = 'https://thumbnails.roblox.com/v1/assets';
const OWNERS_API = 'https://economy.roblox.com/v1/assets';
const PRESENCE_API = 'https://presence.roblox.com/v1/presence/users';

function getAuthHeaders() {
  const headers = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (config['.ROBLOSECURITY']) {
        headers['Cookie'] = `.ROBLOSECURITY=${config['.ROBLOSECURITY']}`;
      }
    } catch {}
  }
  return headers;
}

export async function getThumbnails(assetIds) {
  if (assetIds.length === 0) return {};
  const results = {};
  for (let i = 0; i < assetIds.length; i += 100) {
    const chunk = assetIds.slice(i, i + 100);
    try {
      const url = `${THUMBNAIL_API}?assetIds=${chunk.join(',')}&format=Png&size=150x150`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const json = await res.json();
        for (const item of json.data || []) {
          results[item.targetId] = item.imageUrl;
        }
      }
    } catch {}
  }
  return results;
}

export async function getItemOwners(assetId) {
  const url = `${OWNERS_API}/${assetId}/owners?limit=100&sortOrder=Desc`;
  try {
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`Owners API returned ${res.status} for asset ${assetId}: ${text.substring(0, 100)}`);
      return [];
    }
    const json = await res.json();
    return (json.data || []).map(owner => ({
      userId: owner.owner?.userId || owner.userId,
      username: owner.owner?.username || owner.username,
      serial: owner.serialNumber || null,
    })).filter(o => o.userId);
  } catch (err) {
    console.warn(`Failed to fetch owners for asset ${assetId}:`, err.message);
    return [];
  }
}

export async function checkPresence(userIds) {
  if (userIds.length === 0) return {};
  const results = {};
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);
    try {
      const res = await fetch(PRESENCE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ userIds: chunk }),
      });
      if (res.ok) {
        const json = await res.json();
        for (const user of json.data || []) {
          results[user.userId] = {
            online: user.userPresenceType === 1 || user.userPresenceType === 2,
            presenceType: user.userPresenceType,
            lastOnline: user.lastOnline,
          };
        }
      }
    } catch {}
  }
  return results;
}

export function getTradeUrl(userId) {
  return `https://www.roblox.com/trade/${userId}`;
}
