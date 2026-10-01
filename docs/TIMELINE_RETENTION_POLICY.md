# Timeline Retention Policy

Sprint 7 retention policy for the personal/public-beta MVP.

## Runtime cap

- Each replay timeline is capped at `timelineEventCap` from the quest pack, currently 3,000 events.
- Once the cap is reached, the runner drops further timeline entries and marks the replay summary as truncated.
- The app treats the replay timeline as visualization data, not an audit log.

## Local storage

- Attempt history stores compact metadata: status, replay case id, event count, timeline pointer, hint count, and solution-assisted flag.
- Full timeline payloads are not persisted into long-term app state in Sprint 7.
- Saved code remains per user/profile in localStorage for the MVP.

## Production direction

- Public deployment should store capped timelines with a TTL.
- Large timelines should be compressed server-side before persistence.
- Abuse, crash, and rate-limit telemetry should be separated from user-visible replay data.
