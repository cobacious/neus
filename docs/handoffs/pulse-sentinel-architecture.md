# Pulse Sentinel Architecture & Continuous Ingestion Handoff

This document outlines the architectural plan to replace the static 4-hour cron schedule with a lightweight, event-driven **Pulse Sentinel**.

---

## 1. Context & Motivation

Neus currently operates on a fixed 4-hour cron via `cron-job.org` calling GitHub Actions `workflow_dispatch`.

While this keeps AI compute costs low (~£12/month baseline), it introduces two fundamental problems:
1. **Breaking News Latency**: A story breaking 5 minutes after a cron run sits undetected for nearly 4 hours before Neus notices it.
2. **Feed Drop-off / Article Gaps**: High-frequency news feeds (BBC, Guardian, Daily Mail) publish dozens of articles over 4 hours. Because RSS XML payloads typically retain only the latest 15 to 25 items, older articles get pushed off feeds before our runner ever fetches them.
3. **Overnight Inefficiency**: Running the full 16-step pipeline overnight (00:00 to 06:00 UTC) burns tokens and compute during deep news lulls when few articles exist.

---

## 2. The Solution: Decoupled Pulse Architecture

The Pulse architecture separates fast, continuous ingestion from heavy editorial synthesis:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. THE PULSE (Fast, Continuous Heartbeat)                  │
│    Runs every 20 mins via cron-job.org -> apps/api          │
│    Cost: $0 AI | Duration: ~5-10s                          │
│    Action: Ingests RSS feeds & evaluates editorial velocity │
└──────────────────────────────┬──────────────────────────────┘
                               │
            Meets one of 3 Trigger Policies?
            ├── Breaking Surge (>= 3 sources on new event)
            ├── Batch Threshold (>= 45 unclustered articles)
            └── Heartbeat Staleness (>= 6 hours without run)
                               │
                               ▼ YES (and cooldown > 60m)
┌─────────────────────────────────────────────────────────────┐
│ 2. THE PIPELINE (Heavy Editorial Synthesis)                │
│    Fired on-demand via GitHub Actions workflow_dispatch     │
│    Runs embeddings, clustering, summaries, angles & scores  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Tri-Trigger Policy Matrix

| Policy | Threshold | Rationale | Cost Impact |
| :--- | :--- | :--- | :--- |
| **Safety Cooldown** | $< 60$ minutes since last run, or run `in_progress` | Prevents runaway cascades and thrashing during continuous developing stories | Caps max possible runs at 24/day |
| **Breaking Surge** | $\ge 3$ distinct sources share high headline similarity in last 45m | Immediately captures breaking plane crashes, terror events, resignations or sudden disasters | 15-20 min latency on major breaking news |
| **Batch Accumulation** | $\ge 45$ unclustered articles in database | Routine news accumulation during active daytime hours (~2.5-3.5h) | Smooth, predictable batch clustering |
| **Heartbeat Staleness** | $\ge 6$ hours since last pipeline execution | Lull fallback for quiet weekends and overnight periods; decays scores and prunes archives | Saves compute during news droughts |

---

## 4. Infrastructure & Budget Guardrails

1. **GitHub Actions Runner Minutes**:
   - Free tier limit: 2,000 minutes/month on Ubuntu.
   - The Pulse endpoint runs on Railway ([`apps/api`](file:///Users/jwalton/Code/cobacious/neus/apps/api)), consuming **0 GitHub Actions runner minutes**.
   - GitHub Actions is only invoked when a trigger policy is satisfied. At 4 to 6 runs per day, runner consumption remains ~500 minutes/month (25% of free tier).
2. **Neon PostgreSQL Database Compute**:
   - The 20-minute RSS poll takes ~2 seconds of database write time.
   - 72 pulses/day * 2s = ~144 seconds/day = ~2.1 hours of active compute per month (well under Neon's 100 free compute hours).
3. **AI Token Spend**:
   - Routine Pulse: $0 (pure HTTP GET and SQL upsert).
   - Emergency Surge check: pairwise cosine similarity on newly arrived headlines (or embedding 5 to 15 titles for < $0.0003).

---

## 5. Implementation Status & Live Sandbox

Phase 1 and Phase 2 are complete and operating in a production-identical isolated sandbox:
- **Git Branch**: [`feat/pulse-sentinel`](file:///Users/jwalton/Code/cobacious/neus)
- **Database Branch**: Neon `preview/pulse` (`ep-shy-band-abzebmx3`)
- **API Container**: Railway Preview at `https://neusapi-preview.up.railway.app`
- **Frontend Prototype**: Vercel Preview at `https://neus-git-feat-pulse-sentinel-shipsharp.vercel.app`
- **Shadow Ingestion Watcher**: Configured on `cron-job.org` running every 20 minutes with `?dryRun=true&secret=<API_KEY>`.

### Verified Verification Run (20/10/2026 11:18 UTC)
- **Ingestion**: 14 feeds parsed, 734 articles fetched, 101 new articles synced into `preview/pulse` in 6s. Follow-up run skipped all 732 existing articles in 1.3s.
- **Breaking Surge**: Lexical headline matcher detected real-world breaking event (*"UK to deploy fighter jets to protect Saudi Arabia from Houthi attacks"*) across 5 distinct sources within 45m.
- **Trigger Decision**: Evaluated `shouldTrigger: true`, `reason: 'breaking_surge'`, with GitHub dispatch cleanly bypassed by `dryRun: true`.
- **Compute Cost**: $0 AI tokens.

---

## 6. Documentation & UI Updates Required Upon Production Promotion

When Pulse is promoted from sandbox to `main`, the following documentation and public-facing pages must be updated:
1. [`docs/architecture/pipeline.md`](file:///Users/jwalton/Code/cobacious/neus/docs/architecture/pipeline.md):
   - Update the pipeline flowchart showing the decoupled Pulse ingestion loop and on-demand GitHub Actions trigger.
   - Update the Cadence reference from "Every 4 hours" to "Event-Driven Pulse (20m ingestion, adaptive synthesis)".
2. [`apps/web/src/AboutPage.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/AboutPage.tsx):
   - Update the "How it Works" section to mention the continuous, low-latency Pulse ingestion that captures news as it breaks without burning unnecessary AI compute.
