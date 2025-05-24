# Copilot Context – Neus Backend

## Project Overview

Neus is a news aggregation platform with an emphasis on **neutrality, trust, and thoughtful consumption**. This backend service is responsible for:

- **Sourcing news articles**
- **Clustering articles** into story groups
- **Summarising stories** using neutral language
- **Extracting metadata**, including original sources, publication info, etc.
- **Persisting structured story data**

## Stack

- **Language**: TypeScript
- **Package manager**: pnpm (monorepo with workspaces)
- **Runtime**: Node.js (Serverless compatible — e.g., Vercel/Netlify functions or edge runtimes)
- **Database**: Supabase or PostgreSQL (hosted or local, TBD)
- **AI/NLP**:
  - OpenAI or Claude APIs for summarisation, clustering, and extraction
  - TBD: Lightweight local models or third-party services
- **Hosting/Infra**: Flexible — designed to be deployable on Vercel, Netlify, Railway, or Fly.io

## Project Structure (Tentative)

/neus
/apps
/engine - backend services
/web → future frontend
/mobile → future mobile app
/packages
utils
types

> This folder (`/packages/backend`) is the focus for now.

## Short-Term Goals

- ✅ Set up `pnpm` monorepo with TypeScript
- ✅ Scaffold the `backend` package
- ✅ Set up initial article ingestion (via RSS or scraping)
- 🔜 Use LLM API to:
  - Compare new articles with existing clusters
  - Group into existing or new "stories"
  - Generate a neutral headline + summary
- 🔜 Store results in a structured format (DB or in-memory first)

## Key Entities (v0)

- `Article`: raw input with metadata (title, source, timestamp, full text, etc.)
- `Story`: cluster of related articles with shared topic
- `Summary`: AI-generated neutral version of the story
- `SourceLink`: optional link to press release, report, or transcript

## Preferences

- All code in TypeScript
- Prefer modular, composable design
- Avoid overengineering — move fast, iterate
- Prioritise simplicity, clarity, and readability
- Be generous with `README.md` and inline comments
- Include TODOs or FIXME markers where appropriate
- Copilot: Suggest utility functions for clustering, text cleaning, LLM prompts

---

> Copilot: If you're suggesting code, try to work within this structure. Comment your assumptions if introducing third-party packages.
