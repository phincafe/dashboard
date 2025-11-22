# Square Reports Backend (Render-ready)

- Node + Express
- Uses Square Node SDK and your existing hourly + item routes
- Exposes the same REST endpoints as your original app, plus CORS for the React frontend.

## Local dev

```bash
cd backend
cp .env.example .env   # fill in keys
npm install
npm start
```

This will start on http://localhost:4000.
