export class JsonRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Reads and parses a JSON request without ever buffering more than maxBytes. */
export async function readCappedJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0) throw new JsonRequestError("invalid content-length", 400, "invalid_request");
    if (length > maxBytes) throw new JsonRequestError("request too large", 413, "request_too_large");
  }
  if (!request.body) throw new JsonRequestError("request body is required", 400, "invalid_request");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("request too large").catch(() => undefined);
        throw new JsonRequestError("request too large", 413, "request_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new JsonRequestError("request body must be valid UTF-8 JSON", 400, "invalid_request");
  }
}
