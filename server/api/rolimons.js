const ITEM_API = 'https://www.rolimons.com/itemapi/itemdetails';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

export async function fetchAllItems() {
  const res = await fetch(ITEM_API, { headers });
  if (!res.ok) throw new Error(`Rolimons API returned ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error('Rolimons API returned failure');

  const items = [];
  for (const [id, data] of Object.entries(json.items)) {
    items.push({
      id: Number(id),
      name: data[0],
      acronym: data[1] || '',
      rap: data[2] || 0,
      value: data[3] || 0,
      trend: data[4] || '',
      projected: data[5] || 0,
      demand: data[7] || '',
    });
  }
  return items;
}

export function computeFlippingOpportunities(items) {
  return items
    .filter(i => i.rap > 0 && i.value > 0)
    .map(i => ({
      ...i,
      spread: i.value - i.rap,
      spreadPercent: ((i.value - i.rap) / i.rap * 100).toFixed(1),
      flipScore: ((i.value - i.rap) / i.rap) * (i.demand === 'High' || i.demand === 'Amazing' ? 2 : 1),
    }))
    .filter(i => i.spread > 0)
    .sort((a, b) => b.flipScore - a.flipScore);
}
