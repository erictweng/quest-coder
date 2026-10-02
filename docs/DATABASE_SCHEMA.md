# Quest Coder Database Schema

Progress is stored in SQLite by `lib/progress-store.ts`. The default path is `.data/quest-coder.sqlite`; set `QUEST_CODER_DATABASE_PATH` to change it. The schema is created on first use.

## Tables

### sessions

- `token_hash` text primary key: SHA-256 of the session cookie's token. The token itself is never stored.
- `display_name` text not null
- `created_at` text not null (ISO 8601)
- `last_seen_at` text not null (ISO 8601)

There are no accounts. The cookie is the only key to a save, logging out does not delete the row, and rows idle for more than 400 days are removed when the database is opened.

### progress

- `token_hash` text primary key, references `sessions(token_hash)` with cascade delete
- `payload` text not null: one JSON document, at most 1 MB
- `updated_at` text not null (ISO 8601)

## Progress payload

The payload has two halves with different writers.

Server-owned, changed only by a passing submit or a `POST /api/progress` action:

- `cleared`: `{ [challengeId]: true }`
- `rewards`: `{ xp, shards, grants[], shopPreviewUnlocked }`; `grants` keeps the latest 20
- `reviews`: `{ [packSlug]: { bossId, topic, intervalDays, nextDueAt, lastOutcome, streak, rating } }`
- `hintsOpened`: `{ [challengeId]: count }`
- `solutionOpened`: `{ [challengeId]: true }`

Client-owned, written by `PUT /api/progress`:

- `savedCode`: `{ [challengeId]: source }`, each at most 24,000 bytes
- `attempts`: `{ [challengeId]: attempt[] }`, latest 15 per challenge
- `friendsEnabled`: boolean (no UI at present)

Anything server-owned in a `PUT` body is ignored.

## Scaling note

SQLite on local disk suits one app instance with a durable volume. A multi-instance deployment needs a shared database behind the same functions in `lib/progress-store.ts`.
