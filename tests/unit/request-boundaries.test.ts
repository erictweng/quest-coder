import assert from "node:assert/strict";
import { test } from "node:test";
import { JsonRequestError, readCappedJson } from "../../lib/read-json-request.ts";
import { readCappedResponse, RunnerBoundaryError } from "../../lib/runner-client.ts";

function chunkedStream(chunks: string[], cancelled: { value: boolean }) {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(encoder.encode(chunks[index++]));
      else controller.close();
    },
    cancel() { cancelled.value = true; }
  });
}

test("JSON request reader accepts a streamed body without content-length", async () => {
  const cancelled = { value: false };
  const request = new Request("http://test/api/run", { method: "POST", body: chunkedStream(["{\"source\":", "\"pass\"}"], cancelled), duplex: "half" } as RequestInit);
  assert.deepEqual(await readCappedJson(request, 100), { source: "pass" });
  assert.equal(cancelled.value, false);
});

test("JSON request reader cancels chunked bodies as soon as the cap is exceeded", async () => {
  const cancelled = { value: false };
  const request = new Request("http://test/api/progress", { method: "POST", body: chunkedStream(["1234", "5678", "9"], cancelled), duplex: "half" } as RequestInit);
  await assert.rejects(() => readCappedJson(request, 8), (error: unknown) => error instanceof JsonRequestError && error.status === 413);
  assert.equal(cancelled.value, true);
});

test("runner response reader cancels before buffering an oversized response", async () => {
  const cancelled = { value: false };
  const response = new Response(chunkedStream(["1234", "5678", "9"], cancelled));
  await assert.rejects(() => readCappedResponse(response, 8), (error: unknown) => error instanceof RunnerBoundaryError && error.code === "runner_response_too_large");
  assert.equal(cancelled.value, true);
});
