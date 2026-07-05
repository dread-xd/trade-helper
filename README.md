# Roblox Trade Bot

A web dashboard for tracking Roblox limited items, finding flip opportunities, and managing your trading portfolio.

## Features

- **Market Dashboard** — live stats on tracked items, total value, average RAP
- **Item Browser** — search and filter all limited items with RAP, Value, trend, and demand info
- **Flip Finder** — automatically finds items where Value > RAP with the highest profit potential
- **Portfolio Tracker** — add items you own, track P&L in real time
- **Price History** — view RAP history charts for any item
- **Auto-refresh** — pulls fresh data from Rolimons every 5 minutes

## Quick Start

```bash
git clone https://github.com/dread-xd/roblox-trade-bot.git
cd roblox-trade-bot
npm install
npm start
```

Open **http://localhost:3000** in your browser.

## How It Works

The bot pulls data from the [Rolimons](https://www.rolimons.com) item API, which tracks Roblox limited item prices. It caches the data locally and serves it through a clean web dashboard.

- **RAP** — Recent Average Price (what the item has been selling for)
- **Value** — The item's estimated value (often higher than RAP for demand items)
- **Spread** — Value - RAP; positive means flipping potential
- **Trend** — Whether the item is Rising, Stable, or Declining

## Project Structure

```
roblox-trade-bot/
├── server/
│   ├── index.js          # Express server entry point
│   ├── server.js         # API routes (items, flips, portfolio, stats)
│   ├── fetcher.js        # Rolimons API client + data caching
│   └── api/
│       ├── rolimons.js   # Rolimons item API wrapper
│       └── roblox.js     # Roblox thumbnail API wrapper
├── public/
│   ├── index.html        # Dashboard UI
│   ├── style.css         # Dark theme styles
│   └── app.js            # Frontend logic (Chart.js, search, portfolio)
└── package.json
```

## API Endpoints

| Route | Description |
|---|---|
| `GET /api/stats` | Market overview stats |
| `GET /api/items` | All items (supports `?search=`, `?sort=`, `?minRap=`, `?maxRap=`) |
| `GET /api/items/:id` | Single item with price history |
| `GET /api/flips` | Top 50 flip opportunities |
| `GET /api/portfolio` | User's portfolio |
| `POST /api/portfolio/add` | Add item to portfolio |
| `DELETE /api/portfolio/:index` | Remove from portfolio |
| `POST /api/refresh` | Force refresh from Rolimons |

## License

MIT
