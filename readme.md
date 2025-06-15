# Neus – Context and Vision

## Overview

**Neus** is a news aggregation platform designed for neutrality, trust, and clarity. It aims to reduce polarisation and combat misinformation by rethinking how news is presented, summarised, and sourced. The goal is to provide a calming, credible alternative to algorithmically polarised social feeds and rage-driven headlines.

The MVP is a web and mobile app with a **news feed** as the core experience. Articles covering the same story from different publications are grouped into a single **story card**, featuring:

- An **AI-generated neutral headline and summary**
- A tray of **publication icons/logos** that link to the original sources
- Optional **source material links** (e.g. press releases, research papers)

## Goals

- Rebuild trust in journalism through **transparency**, **nuance**, and **context**
- Offer a more **balanced and informative** way to stay updated
- Support thoughtful **consumption over dopamine-fueled doomscrolling**
- Enable **users to explore multiple perspectives** on a story

## Guiding Principles

- **Neutral summaries**: Use AI to abstract away ideological slants in headlines and lead-ins
- **Clustered stories**: Group related articles from different outlets into a single story unit
- **Source visibility**: Where possible, link directly to underlying documents or data
- **Relevance over virality**: Prioritise accuracy and insight, not clicks
- **Future-proofing**: Design the architecture to support premium features and extensions

## Potential Premium Features (Post-MVP)

- **Article heatmaps**: Highlight facts, opinions, and contested claims within articles
- **Fact check overlays**: Inline fact-checking and cross-source validation
- **What’s Missing**: Highlight key facts or perspectives mentioned in other articles but omitted in the current one
- **Endorsements and signals**: Let qualified users endorse or contextualise claims

## Tech Strategy

- **Monorepo** setup using `pnpm` workspaces
- Written in **TypeScript** (backend + frontend)
- Start with a **serverless-friendly backend**, storing and analysing articles
- Use **LLMs** for story clustering, summarisation, and claim detection
- Store structured data in **PostgreSQL** or **Supabase**, starting simple
- Explore **Edge Functions** and **cron jobs** for scheduled tasks (e.g., news scraping)

## Monetisation Strategy (Future)

- Likely via **freemium** or **optional subscription**
- No ads, no engagement bait
- Revenue model must align with the ethos of **calm, honest information**

## Current Phase

We're starting with:

- The **backend pipeline** for sourcing, clustering, and summarising articles
- A working prototype that can ingest articles and return grouped, summarised story objects

---

## Engine Setup

The backend engine expects a `.env` file under `apps/engine`.
Start by copying the example provided:

```bash
cp apps/engine/.env.example apps/engine/.env
```

Fill in the values (at minimum `OPENAI_API_KEY`) before running the pipeline.


> This document is a living artifact and should evolve as the product vision and tech stack grow.
