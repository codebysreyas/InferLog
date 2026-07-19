# Inferlog

A logging and observability platform for multi-provider LLM applications: a chat
interface, conversation history, and a dashboard tracking latency, token usage,
and error rate across providers — with a drop-in SDK that ships inference logs
asynchronously so logging never blocks a request.

## Architecture

```
┌─────────────┐      POST /api/chat (stream)      ┌──────────────────┐
│  Chat UI    │ ─────────────────────────────────▶ │  Route Handler   │
│  (client)   │ ◀───────── ndjson stream ────────── │  /api/chat       │
└─────────────┘                                     └────────┬─────────┘
                                                              │ uses
                                                              ▼
                                                     ┌──────────────────┐
                                                     │  LoggedProvider   │  sdk/wrapper.ts
                                                     │  (SDK wrapper)    │
                                                     └────────┬──────────┘
                                                              │ delegates to
                                                              ▼
                                                     ┌──────────────────┐
                                                     │   AIProvider      │  src/lib/providers/*
                                                     │ NVIDIA / OpenAI /  │
                                                     │ Claude / Gemini    │
                                                     └────────┬──────────┘
                                                              │ fire-and-forget
                                                              ▼
                                          POST /api/logs  ┌──────────────────┐
                                        ◀─────────────────│ InferenceLogger   │  sdk/logger.ts
                                                           └──────────────────┘
                                                              │
                                                              ▼
                                                     ┌──────────────────┐
                                                     │  Ingestion route  │  validates (Zod),
                                                     │  /api/logs        │  redacts PII, persists
                                                     └────────┬──────────┘
                                                              │ emits
                                                              ▼
                                                     ┌──────────────────┐
                                                     │   Event bus        │  src/lib/events.ts
                                                     │ "inference.logged" │  (Node EventEmitter)
                                                     └────────┬──────────┘
                                                              │
                                              ┌───────────────┴────────────────┐
                                              ▼                                ▼
                                     ┌──────────────┐                ┌──────────────────┐
                                     │  PostgreSQL   │                │  Dashboard         │
                                     │  (Prisma)     │◀──────────────│  /api/dashboard/*  │
                                     └──────────────┘   polls (15s)   └──────────────────┘
```

**Why this shape:** the chat route owns conversation persistence (so history survives
even if a client disconnects mid-stream), while inference logging is a *separate*
concern handled by the SDK and ingestion endpoint. The SDK wraps any `AIProvider`
and never throws on log failure — a logging outage must never break inference.
The event bus decouples ingestion from anything that reacts to it; today that's
just the dashboard's next poll, but it's the seam where you'd hang webhooks,
alerting, or a message queue later without touching the ingestion route.

## Folder structure

```
inference-logger/
├── prisma/
│   └── schema.prisma          # Conversation, Message, InferenceLog models
├── sdk/                        # Standalone logging SDK
│   ├── client.ts               # createLoggedProvider() entry point
│   ├── wrapper.ts              # LoggedProvider — wraps chat()/stream()
│   ├── logger.ts               # Fire-and-forget log shipper
│   └── types.ts
├── src/
│   ├── app/
│   │   ├── page.tsx             # Landing
│   │   ├── chat/                # Chat UI (streaming, markdown, retry)
│   │   ├── conversations/       # History, search, delete
│   │   ├── dashboard/           # Recharts analytics
│   │   ├── settings/            # Provider configuration status
│   │   ├── not-found.tsx
│   │   └── api/
│   │       ├── chat/route.ts            # Streaming chat endpoint
│   │       ├── logs/route.ts            # Ingestion endpoint
│   │       ├── conversations/           # CRUD
│   │       ├── dashboard/stats/route.ts # Aggregated metrics
│   │       └── settings/route.ts
│   ├── components/              # Button, Card, Badge, Nav, ErrorBoundary
│   ├── hooks/use-toast.tsx
│   └── lib/
│       ├── providers/           # AIProvider abstraction (NVIDIA/OpenAI/Claude/Gemini)
│       ├── db.ts                # Prisma client singleton
│       ├── events.ts            # Event bus
│       ├── pii.ts               # Redaction rules
│       └── validation.ts        # Zod schemas
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## ER diagram

```
┌────────────────────┐        ┌────────────────────┐        ┌────────────────────┐
│    Conversation     │        │      Message        │        │    InferenceLog     │
├────────────────────┤        ├────────────────────┤        ├────────────────────┤
│ id            PK    │◀──┐    │ id            PK    │◀──┐    │ id            PK    │
│ title                │   │    │ conversationId FK────┘    │ requestId     UQ    │
│ provider             │   └───────conversationId FK ───────┤ conversationId FK   │
│ model                │        │ role                │    │ messageId     FK    │
│ createdAt            │        │ content              │    │ provider             │
│ updatedAt            │        │ createdAt            │    │ model                │
└────────────────────┘        └────────────────────┘        │ promptPreview        │
                                                               │ completionPreview    │
                                                               │ promptTokens         │
                                                               │ completionTokens     │
                                                               │ totalTokens          │
                                                               │ latencyMs            │
                                                               │ status               │
                                                               │ errorMessage         │
                                                               │ createdAt            │
                                                               └────────────────────┘
```

Both `Message → Conversation` and `InferenceLog → Conversation` cascade on delete;
`InferenceLog → Message` sets null so logs survive if a single message is pruned.

## Setup

### Option A — Docker (recommended)

```bash
cp .env.example .env
# edit .env and set NVIDIA_API_KEY

docker compose up --build
```

The app runs migrations on boot and is available at `http://localhost:3000`.

### Option B — Local

```bash
npm install
cp .env.example .env
# point DATABASE_URL at a local Postgres instance, set NVIDIA_API_KEY

npx prisma migrate dev --name init
npm run dev
```

## Provider configuration

Only NVIDIA is required to exercise the app end-to-end:

```
NVIDIA_API_KEY=<placeholder>
NVIDIA_MODEL=nvidia/nemotron-3-super-120b-a12b
```

OpenAI, Claude, and Gemini implement the same `AIProvider` interface
(`src/lib/providers/*`) and activate automatically once their respective API
keys are set — no code changes required. Selecting an unconfigured provider in
the chat UI surfaces a clear error rather than failing silently.

## Tradeoffs

- **Polling over websockets for the dashboard.** A 15s poll is simpler to reason
  about and sufficient for an analytics view; a websocket/SSE push would be the
  next step if sub-second freshness mattered.
- **EventEmitter instead of a message broker.** Correct for a single-process
  deployment and keeps the event contract explicit; swapping in Redis pub/sub or
  a queue means changing `src/lib/events.ts` only, not any call sites.
- **Regex-based PII redaction.** Cheap and dependency-free, covers the required
  categories, but isn't a substitute for a proper NER-based redaction service at
  higher accuracy requirements.
- **Title generation is heuristic (first 60 chars), not LLM-generated**, to avoid
  a second inference call — and therefore cost and latency — on every new
  conversation.

## Scaling

- Add a read replica and point `/api/dashboard/stats` at it; the aggregation
  query is read-only and safe to isolate from write traffic.
- Move the event bus to Redis pub/sub (or a queue) once logging needs to fan out
  across multiple app instances.
- Partition `inference_logs` by `createdAt` once volume makes the 24h dashboard
  scan expensive.

## Future improvements

- Server-Sent Events for the dashboard instead of polling.
- Per-user auth and API keys for the ingestion endpoint.
- Configurable retention policy for inference logs.
- Streaming token-level cost estimation per provider.

## Screenshots

_Add screenshots of `/`, `/chat`, `/dashboard`, and `/conversations` here before
submitting._

## Deployment

The `Dockerfile` builds a standalone-ish production image; deploy `app` and
`postgres` from `docker-compose.yml` to any container host (Fly.io, Railway,
ECS). Set `DATABASE_URL` and provider keys as environment/secret variables —
never commit `.env`.
