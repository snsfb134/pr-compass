# PR Compass

Korean version: [README.ko.md](./README.ko.md)

PR Compass is a personal product project for tracking official Canadian immigration updates in one place and turning them into a clearer, more actionable view for applicants.

The goal is to reduce the friction of checking scattered government and program pages, preserving change history, and surfacing which updates may matter more based on a user's profile.

## Overview

Canadian immigration information is spread across multiple official sources such as IRCC and WelcomeBC. Important updates can appear without much context, and applicants often need to revisit the same pages repeatedly just to see what changed.

PR Compass is designed to help with that by:

- monitoring official immigration sources on a recurring basis
- storing snapshots and change history for later comparison
- separating public signals from profile-specific impact
- presenting a more decision-oriented flow instead of a raw list of updates

## Current Scope

The current implementation includes:

- a FastAPI backend for source checks, records, profile data, and aggregated insights
- a Next.js frontend for the user-facing dashboard experience
- recurring checks for selected official immigration pages
- snapshot storage and official change history tracking
- profile input, completion, and locked/unlocked workflow states
- separation between public signals and personalized impact views

AI-assisted summaries are not yet wired into the live product flow.
Planned summary and interpretation features are intended for a future integration using the free tier of `Gemini`.

## Planned Gemini Integration

Planned future capabilities include:

- summarizing the key point of an official update
- highlighting what changed compared with the previous state
- explaining likely impact based on a user's profile
- suggesting what the user should check next

The first integration target is the free tier of `Gemini` to keep the early version lightweight and cost-conscious.

## Tech Stack

- Backend: FastAPI, Python, SQLite
- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Data layer: scheduled source checks, snapshot storage, official record extraction, change tracking

## Project Structure

```text
app/        FastAPI backend
web/        Next.js frontend
scripts/    monitoring utilities
data/       local runtime data (ignored in Git)
```

## Running Locally

### 1. Start the backend

```bash
git clone <your-repository-url>
cd pr-compass
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

### 2. Start the frontend

```bash
cd web
yarn install
yarn dev
```

### 3. Open the app

- Frontend: `http://127.0.0.1:3000`
- Backend API: `http://127.0.0.1:8010`

## Notes

- This project is intended to make official immigration information easier to track and interpret. It does not provide legal advice.
- Local databases, logs, snapshots, and environment files are excluded from the public repository.

## Roadmap

- integrate Gemini-based update summaries and interpretation
- improve signal grouping across major immigration streams
- refine notification and prioritization logic per user profile
- prepare a cleaner deployable demo environment
