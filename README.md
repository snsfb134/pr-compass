# PR Compass

Korean version: [README.ko.md](./README.ko.md)

PR Compass is an AI-assisted briefing product for Korean-speaking users who want to track official Canadian immigration updates without manually checking scattered government pages.

The current MVP focuses on **BC PNP + Express Entry**. It monitors official sources, stores structured records, compares new updates with historical data, and turns the result into short email briefings plus a subscriber-only one-page analysis.

> PR Compass helps users read official updates more clearly. It does not provide legal advice.

## Product Direction

PR Compass is no longer centered on a personal CRS/profile dashboard. The product has been simplified into a subscription-first briefing service:

- public landing page for newsletter subscription
- sample briefing page using the same layout as subscriber briefings
- email briefing preview and mock/SMTP delivery flow
- official source monitoring for WelcomeBC and IRCC
- structured records for BC PNP draws and Express Entry rounds
- replay QA that simulates historical official updates before Gemini is connected
- admin briefing review page for checking generated copy before sending

The brand remains **PR Compass**, with **Your True North** used only as a small supporting slogan.

## How It Works

```text
Official source check
  -> new or changed official data
  -> structured records and change history
  -> briefing input builder
  -> heuristic/agent analysis provider
  -> normalized PR Compass briefing schema
  -> email preview / queue
  -> subscriber one-page briefing
```

Gemini is planned as the production analysis provider, but the current code intentionally supports deterministic replay and provider contract testing first. The LLM layer interprets and summarizes official data; it does not create official records.

## Current Features

- Dark subscription landing page for BC PNP + Express Entry briefings
- Subscription form with name, email, and affiliation
- `/briefing/sample` sample briefing page
- `/briefing/[token]` subscriber briefing route
- `/admin/briefings` operator review page
- FastAPI source checks, snapshots, changes, and official records
- SQLite-backed briefing runs and email queue
- Mock outbox, SMTP delivery, and Resend-ready delivery hooks
- Historical replay scripts for pre-Gemini QA
- Provider contract validation before Gemini integration

Legacy profile, CRS, simulator, and route-comparison screens may still exist in the codebase, but they are no longer the main product flow.

## Tech Stack

- Backend: FastAPI, Python, SQLite
- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Data: source snapshots, structured official records, briefing runs, email queue
- Email: mock outbox, SMTP, optional Resend integration
- Planned AI provider: Gemini

## Project Structure

```text
app/        FastAPI backend and briefing pipeline
web/        Next.js frontend, landing, subscriber briefing, admin review
scripts/    source checks, replay QA, email delivery utilities
data/       local runtime data, DBs, snapshots, generated reports (not committed)
docs/       local planning notes and operating drafts
```

## Running Locally

### 1. Backend

```bash
git clone <your-repository-url>
cd pr-compass
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

### 2. Frontend

```bash
cd web
yarn install
yarn dev
```

### 3. Open

- Landing page: `http://127.0.0.1:3000`
- Sample briefing: `http://127.0.0.1:3000/briefing/sample`
- Admin briefing review: `http://127.0.0.1:3000/admin/briefings`
- Backend API: `http://127.0.0.1:8010`

## Environment

Copy `web/.env.example` when configuring local frontend and email testing.

Required for frontend-to-backend calls:

```bash
NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8010"
```

Optional for local SMTP testing:

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USERNAME=""
SMTP_PASSWORD=""
SMTP_FROM_EMAIL="PR Compass <your-email@example.com>"
SMTP_USE_SSL="false"
```

Do not commit real credentials or local `.env` files.

## Useful Commands

Build the frontend:

```bash
yarn --cwd web build
```

Run one source check:

```bash
.venv/bin/python scripts/check_once.py
```

Run historical replay QA:

```bash
.venv/bin/python scripts/replay_historical_update_flow.py --all --summary-only --pretty
```

Validate the analysis provider contract:

```bash
.venv/bin/python scripts/test_analysis_provider_contract.py
```

Send a test briefing email or render a mock outbox item:

```bash
.venv/bin/python scripts/send_test_briefing_email.py --recipient-email you@example.com --scenarios 1 --pretty
```

## Pre-Gemini Readiness

Before connecting Gemini, the project should pass:

- official source freshness and structured record checks
- full historical replay across BC PNP and Express Entry records
- provider strict JSON contract validation
- email preview copy review
- mock/SMTP email delivery test
- subscriber briefing page review using the same normalized schema

## Roadmap

- connect Gemini as the production analysis provider
- add operator approval before real email sends
- improve update-type-specific email templates
- add weekly "no major change" status briefings
- expand beyond BC PNP after the initial subscriber test
