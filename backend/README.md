# Square Reports Backend (Fixed for new Square SDK)

- Node + Express
- Uses Square Node SDK v43 (`token` instead of `accessToken`)
- Responses use top-level `locations`, `orders`, `refunds` fields.

## Local dev

```bash
cd backend
cp .env.example .env   # fill in SQUARE_ACCESS_TOKEN, etc.
npm install
npm start
```

Then hit:

- GET http://localhost:4000/api/test-square
- GET http://localhost:4000/api/sales?date=2025-01-01
