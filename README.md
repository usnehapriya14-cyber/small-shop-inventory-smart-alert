# Little Ledger — Small Shop Inventory Alerts

A small-shop inventory dashboard for tracking products, adjusting quantities, and spotting items that need a restock. It is designed as a one-day hackathon MVP: one app, one local database, and in-app alerts (no external messaging setup).

## Features

- Browse, search, and filter products by stock status or category.
- Add, edit, and remove products.
- Adjust stock quantities directly from the product list.
- Set a reorder level for each product and see low-stock/out-of-stock alerts.
- View dashboard counts and the estimated retail value of current stock.
- Store inventory in SQLite so changes remain after restarting the app.
- Validate product details and stock adjustments in the API.

## Requirements

- Node.js 22.13 or newer
- npm

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the API and frontend together:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:3001](http://localhost:3001).

The database is created at `data/inventory.db` on first run and starts with a handful of demo products. Delete that specific database file to reset the demo data; it will be re-seeded the next time the API starts.

### Windows shell note

If npm reports that it cannot spawn a path ending in `.msix`, the current PowerShell session has an invalid `ComSpec` value. Reset it for that session, then retry the npm command:

```powershell
$env:ComSpec = "$env:SystemRoot\System32\cmd.exe"
$env:COMSPEC = $env:ComSpec
npm install
```

## Production build

```bash
npm run build
npm start
```

Build output is written to `dist/`. The Express server serves the production frontend and API from the same origin. Set `PORT` to change the API port.

## Deploy to Railway

This app serves the built frontend and API from one service. SQLite data must live on a Railway Volume because a service's regular filesystem is temporary.

1. Push the project to a GitHub repository.
2. In Railway, create a project and deploy from that GitHub repository.
3. Add a Volume to the service and set its mount path to `/app/data`.
4. Set `NODE_ENV` to `production`. Railway supplies the `PORT` variable.
5. Railway reads the included `railway.json` build, start, and health-check configuration.
6. After deployment, open the service's generated public domain. The API health endpoint is `/api/health`.

The volume mount path matches the app's default SQLite database directory. Do not deploy the database file as source code.

## Test

```bash
npm test
```

The API tests cover product creation, duplicate SKUs, invalid input, stock adjustment limits, editing, and deletion.

## Project structure

```text
frontend/
  index.html            Browser entry point
  src/
    App.jsx             Dashboard, product table, alerts, and forms
    main.jsx            React bootstrap
    styles.css          Responsive layout and visual design
server/
  app.js                Express routes, validation, and error handling
  app.test.js           API workflow tests
  database.js           SQLite schema and demo seed data
  index.js              Starts the API server
vite.config.js          Vite setup and /api development proxy
```

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check that the API is running |
| `GET` | `/api/products` | List inventory |
| `POST` | `/api/products` | Add a product |
| `PUT` | `/api/products/:id` | Replace product details |
| `PATCH` | `/api/products/:id/stock` | Adjust stock with `{ "delta": 3 }` or a negative delta |
| `DELETE` | `/api/products/:id` | Remove a product |

The dashboard marks stock as low when it is at or below that product's reorder level, and as out of stock when the quantity is zero.
