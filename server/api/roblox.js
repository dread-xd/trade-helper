const THUMBNAIL_API = 'https://thumbnails.roblox.com/v1/assets';

export async function getThumbnailUrl(assetId) {
  const url = `${THUMBNAIL_API}?assetIds=${assetId}&format=Png&size=150x150`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.[0]?.imageUrl || null;
}

export async function getThumbnails(assetIds) {
  if (assetIds.length === 0) return {};
  const chunkSize = 100;
  const results = {};
  for (let i = 0; i < assetIds.length; i += chunkSize) {
    const chunk = assetIds.slice(i, i + chunkSize);
    const url = `${THUMBNAIL_API}?assetIds=${chunk.join(',')}&format=Png&size=150x150`;
    try {
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
