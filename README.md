# Square Reports (React + Backend, Render-ready)

This repo splits your existing Render app into:

- `backend/` — Node + Express + Square SDK + your hourly & item routes
- `frontend/` — Vite + React dashboard (Daily sales, Hourly heatmap, Item sales + AI insights)

## Local dev

Backend:

```bash
cd backend
cp .env.example .env      # fill in SQUARE_ACCESS_TOKEN, etc.
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:4000" > .env
npm run dev
```

## Deploy to Render

1. Zip this whole folder and upload to GitHub.
2. Create a **Render Web Service** for `backend/`:
   - Build command: `cd backend && npm install`
   - Start command: `cd backend && npm start`
   - Set environment variables from `.env.example`.
3. Create a **Render Static Site** for `frontend/`:
   - Build command: `cd frontend && npm install && npm run build`
   - Publish directory: `frontend/dist`
   - Add env var `VITE_API_BASE_URL` pointing to your backend URL.
