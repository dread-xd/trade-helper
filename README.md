# Trade Helper

Find owners of any Roblox limited item and send them trade offers.

## How it works

1. **Search** for the item you want to offer and the item you want to receive
2. **Find owners** — the bot looks up who owns the target item via Roblox's API
3. **Check online status** — sees who's currently online
4. **Send trade** — click a user to open the Roblox trade page with them

## Quick Start

```bash
git clone https://github.com/dread-xd/roblox-trade-bot.git
cd roblox-trade-bot
npm install
npm start
```

Open **http://localhost:3000**

## Features

- **Send Trade** — pick items, find owners, send offers
- **Item Browser** — search/filter all limited items with RAP, Value, trend, demand
- **Portfolio** — track items you own with live P&L
- **Online detection** — see which owners are online right now

## API

| Route | Description |
|---|---|
| `GET /api/items` | Search items (`?search=`, `?sort=`, `?minRap=`, `?maxRap=`) |
| `GET /api/items/:id` | Item details with price history |
| `GET /api/trade/find?targetItemId=X&offerItemId=Y` | Find owners + online status |
| `GET /api/stats` | Market stats |
| `POST /api/refresh` | Force re-fetch from Rolimons |

## License

MIT
