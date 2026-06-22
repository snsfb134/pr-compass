# Web app scaffold

This folder holds the local Next.js front end for PR Compass.

## Local setup

1. Start the FastAPI backend on `http://127.0.0.1:8010` before starting Next.
2. Set `DATABASE_URL` to your Postgres instance.
3. Set `NEXT_PUBLIC_API_BASE_URL` to the FastAPI backend, usually `http://127.0.0.1:8010`.
4. Install dependencies and run:

```bash
yarn install
yarn dev
```

If the backend changes profile behavior or schema, restart `8010` first and then restart `3000`.

## Intent

- Next.js for the user-facing dashboard
- TypeScript for structure and safety
- Prisma for Postgres access
- Tailwind for minimal layout and spacing only
