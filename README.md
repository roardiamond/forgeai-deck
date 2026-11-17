# ForgeAI

Turn any data into a clear, professional outcome.

Paste a brief, notes, a log, or a CSV — or upload `.txt`, `.csv`, or `.md`. ForgeAI reads it and returns a finished artifact: a report, an action plan, a document, a code map, or an insight brief. Revise in place. Copy anything. History stays on your account.

## Your API key

The model key is read from one file, and only on the server.

1. In the project root, copy `.env.example` to `.env`.
2. Open `.env`.
3. Paste your xAI key on this line:

```
XAI_API_KEY=xai-your-key-here
```

Get the key from [console.x.ai](https://console.x.ai). Do not commit `.env`. Restart `npm run dev` after you save it.

```
npm install
npm run dev
```

Open http://localhost:8080. Create an account on the sign-in page (email and password), then forge. History is stored in the local database. No other key is required to run it.


## What to try

1. Load **Client brief**. The form switches to Document.
2. Choose **Forge outcome**. You get a proposal: scope, stack, timeline, folder map.
3. Ask it to tighten the timeline or add owners.
4. Open **History** and come back to an earlier outcome.
5. Try **Monthly numbers** as Insights, **Error log** as a Code map, and **Messy notes** as an Action plan.

## Outcome forms

| Form | What you get |
| --- | --- |
| Report | Snapshot, findings table, implications, open questions |
| Action plan | Sequence with owners and effort, this week, risks, done when |
| Document | Proposal, brief, SOP, or spec filled from the source |
| Code map | Diagnosis and a fix, or a folder tree plus starter files |
| Insights | Metrics, what stands out, recommendations tied to the data |

## 60-second demo

1. Open ForgeAI. The four samples are the script.
2. Click **Client brief**. Document is already selected. Hit **Forge outcome**.
3. While it writes: raw client notes become a proposal with stack, timeline, and a starter repo map.
4. When it lands, hit **Copy all**. Scroll the folder map.
5. Press **Add owners, effort, and a this-week sequence**.
6. Point at **History**. The revised proposal is saved to the account.

## System prompts

Live prompts: `src/lib/forge/prompts.ts`.

**Forge**

```
You are ForgeAI. You turn raw operational, business, product, and technical data into a finished professional outcome.

Rules:
- Output a single JSON object and nothing else. No markdown fences around the JSON.
- Shape: {"title": string, "markdown": string, "note": string}
- title: specific, at most 8 words, no trailing punctuation.
- markdown: GitHub-flavored markdown the reader can paste into a doc or a repo. It is the full outcome, not a description of an outcome.
- note: one short sentence on what you produced.
- Never frame the work as studying, teaching, exams, coursework, or student support. If the source is about those topics, return markdown that says ForgeAI only handles business, product, operations, and engineering data, and stop.
- Do not invent figures, names, dates, or commitments that are not in the source. Mark gaps as [needed].
- Write in plain professional English. No hype, no emoji, no preamble, no apology.
- Prefer decisions, owners, sequence, and concrete artifacts over generic advice.
- Use tables and task lists when they make the outcome faster to scan.
- Fenced code blocks must name a language. When a block is a file, the first line states the path.
```

A second block, one per form, tells the model the exact sections to write (report, action plan, document, code map, insights). Client and project requests written as a Document include scope, stack, timeline, and a folder map.

**Revise**

```
You are ForgeAI revising an outcome you already wrote.
The user will ask to improve, expand, shorten, restructure, or change it.
Return a single JSON object and nothing else: {"title": string, "markdown": string, "note": string}
- markdown is the FULL revised document, not a diff and not a list of edits.
- Keep every fact consistent with the source. Do not invent numbers, clients, or dates.
- note is one sentence describing what changed.
- Never reframe the work as studying, exams, or teaching.
- Preserve useful structure unless the user asked to change it.
```

The model is `grok-4.5` through the server. Calls happen only when you forge or revise. Output is capped.

## Data

Outcomes are stored per account. Schema: `migrations/0002_outcomes.sql`.

```sql
create table if not exists outcomes (
  id text primary key,
  user_id text not null,
  title text not null,
  kind text not null,
  source_name text not null default '',
  source_excerpt text not null,
  source_text text not null,
  result_markdown text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Account tables live in `migrations/0001_auth.sql`.

## Stack

React, TypeScript, and Tailwind on TanStack Start. Sign-in is email and password on your own machine, plus Google and X when the app is hosted. The model is `grok-4.5` through `XAI_API_KEY` in `.env`. History uses a local Postgres-compatible database unless you set `DATABASE_URL`.

## Layout

```
src/routes/index.tsx            workbench
src/routes/login.tsx            sign-in
src/routes/api/auth/$.ts        auth handler
src/components/forge/           UI, markdown, copy
src/lib/forge/api.ts            forge, revise, history
src/lib/forge/prompts.ts        system prompts
src/lib/forge/samples.ts        demo sources
migrations/0002_outcomes.sql    history schema
```
