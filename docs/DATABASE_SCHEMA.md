# Quest Coder Personal MVP Database Schema

Sprint 4 implements persistence in browser `localStorage` for the personal MVP, while documenting the database shape that Sprint 4 app state maps to. A later server database can lift these tables directly into Postgres/SQLite.

## Tables

### users

- `id` text primary key
- `display_name` text not null
- `created_at` timestamp not null
- `last_login_at` timestamp not null

Personal MVP mapping: `quest-coder:session` stores the active display name.

### quest_packs

- `id` text primary key
- `slug` text unique not null
- `title` text not null
- `schema_version` text not null
- `status` text not null
- `raw_json` json not null

Personal MVP mapping: checked-in JSON under `content/packs/*.json`.

### challenges

- `id` text primary key
- `pack_id` text not null references `quest_packs(id)`
- `kind` text not null check in (`quest`, `boss`)
- `order_index` integer
- `title` text not null
- `entrypoint` text not null
- `starter_code` text not null
- `solution_code` text not null
- `unlock_requires` json not null

Personal MVP mapping: `pack.quests[]` and `pack.boss`.

### user_progress

- `user_id` text not null references `users(id)`
- `challenge_id` text not null references `challenges(id)`
- `cleared` boolean not null default false
- `solution_opened` boolean not null default false
- `saved_code` text not null default empty string
- `updated_at` timestamp not null
- primary key (`user_id`, `challenge_id`)

Personal MVP mapping: `quest-coder:profile:<displayName>.cleared`, `.solutionOpened`, `.savedCode`.

### attempts

- `id` text primary key
- `user_id` text not null references `users(id)`
- `challenge_id` text not null references `challenges(id)`
- `status` text not null
- `passed` boolean not null
- `replay_case_id` text
- `event_count` integer not null
- `timeline_pointer` text not null
- `solution_assisted` boolean not null
- `created_at` timestamp not null

Personal MVP mapping: `quest-coder:profile:<displayName>.attempts[challengeId][]`.

### timelines

- `id` text primary key
- `attempt_id` text not null references `attempts(id)`
- `storage_pointer` text not null
- `schema_version` text not null
- `summary_json` json not null

Personal MVP mapping: timeline pointer is recorded in each attempt as `<challengeId>:<caseId>:<startedAt>`. Full timelines are still returned live by `/api/run`; long-term server-side timeline storage is deferred.

## Sprint 4 persistence rule

The UI must prove the shape end to end before adding real auth/database infrastructure: sign in, run/clear quests, unlock boss, log out, sign back in, and recover progress from the persisted profile blob.
