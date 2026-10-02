export const RUN_SCHEMA_VERSION = "quest-coder.run.v1" as const;
export const ACTIVE_PACK_SLUG = "forest-of-patience-climbing-stairs" as const;
export const ACTIVE_CHALLENGE_IDS = [
  "patience-last-jump",
  "patience-route-scroll",
  "patience-two-slot-pouch",
  "boss-old-bramblehorn"
] as const;

export type RunMode = "run" | "submit";
export type RunRequest = {
  source: string;
  packSlug: typeof ACTIVE_PACK_SLUG;
  challengeId: (typeof ACTIVE_CHALLENGE_IDS)[number];
  mode: RunMode;
  solutionAssisted: boolean;
  hintCount: number;
};

export function parseRunRequest(value: unknown): RunRequest {
  if (!value || typeof value !== "object") throw new RunValidationError("request body must be an object");
  const body = value as Record<string, unknown>;
  const allowedFields = new Set(["source", "packSlug", "challengeId", "mode", "solutionAssisted", "hintCount"]);
  const unknownField = Object.keys(body).find((key) => !allowedFields.has(key));
  if (unknownField) throw new RunValidationError(`unknown field: ${unknownField}`);
  if (typeof body.source !== "string" || !body.source.trim()) throw new RunValidationError("source must be a non-empty Python string");
  if (Buffer.byteLength(body.source, "utf8") > 24_000) throw new RunValidationError("source exceeds 24000 byte public limit");
  if (body.packSlug !== ACTIVE_PACK_SLUG) throw new RunValidationError("unknown pack");
  if (typeof body.challengeId !== "string" || !ACTIVE_CHALLENGE_IDS.includes(body.challengeId as RunRequest["challengeId"])) throw new RunValidationError("unknown challenge");
  if (body.mode !== "run" && body.mode !== "submit") throw new RunValidationError("mode must be run or submit");
  if (body.solutionAssisted !== undefined && typeof body.solutionAssisted !== "boolean") throw new RunValidationError("solutionAssisted must be boolean");
  if (body.hintCount !== undefined && (!Number.isInteger(body.hintCount) || Number(body.hintCount) < 0 || Number(body.hintCount) > 20)) throw new RunValidationError("hintCount must be an integer from 0 to 20");
  return { ...body, solutionAssisted: body.solutionAssisted === true, hintCount: typeof body.hintCount === "number" ? body.hintCount : 0 } as RunRequest;
}

export class RunValidationError extends Error {}
