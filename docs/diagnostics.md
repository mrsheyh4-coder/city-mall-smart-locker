# Self-Healing Developer Diagnostics

The project includes root-level scripts that help catch and repair common local development issues.

## Commands

```bash
npm run doctor
npm run verify
npm run fix:frontend-cache
```

## Doctor

`npm run doctor` checks the live development environment:

- backend `.env`
- PostgreSQL connection
- Prisma generation
- migration status
- locker seed count
- backend API response
- frontend response
- stale Next.js cache symptoms

If the backend is running on Windows, Prisma may lock the query engine DLL. In that case the doctor reports a warning instead of failing because the app itself is healthy.

## Verify

`npm run verify` is the stricter project quality gate. It runs:

- backend lint
- backend build
- backend e2e tests
- frontend lint
- frontend build

Use it before major demos or before committing code.

If the frontend dev server is running on port `3000`, verify temporarily stops it before `next build` and restarts it afterwards. This prevents stale `.next` cache/runtime chunk errors during local development.

## Frontend Cache Fix

`npm run fix:frontend-cache` stops the frontend process on port `3000` when possible and deletes `frontend/.next`.

Use it when Next.js shows missing compiled chunk errors such as:

```txt
Cannot find module './611.js'
```
