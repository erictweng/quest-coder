#!/usr/bin/env bash
set -euo pipefail

image="quest-coder-runner:ci"
container="quest-coder-runner-ci"
network="quest-coder-runner-ci-net"
token="ci-runner-token-not-a-production-secret"
fixture="$PWD/runner/tests/fixtures/non-production-private-pack.json"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "--- runner container logs ---" >&2
    docker logs "$container" >&2 2>&1 || true
    docker inspect -f 'state={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' "$container" >&2 2>&1 || true
  fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -f runner/service/Dockerfile -t "$image" .
docker network create --internal "$network" >/dev/null
# Docker does not publish ports for containers on an --internal network, so every
# HTTP probe below runs inside the container against its own loopback listener.
docker run -d --name "$container" \
  --network "$network" \
  --read-only --tmpfs /tmp:size=16m,noexec,nosuid \
  --cap-drop ALL --security-opt no-new-privileges --pids-limit 32 \
  --mount "type=bind,src=$fixture,dst=/run/secrets/quest_coder_private_pack,readonly" \
  -e QUEST_CODER_RUNNER_TOKEN="$token" \
  -e QUEST_CODER_RUNNER_HOST=0.0.0.0 \
  -e QUEST_CODER_PRIVATE_PACK_PATH=/run/secrets/quest_coder_private_pack \
  "$image" >/dev/null

docker exec -i "$container" python3 - <<'PY'
import time, urllib.request
for _ in range(100):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8787/healthz', timeout=.2) as response:
            if response.status == 200:
                break
    except Exception:
        time.sleep(.1)
else:
    raise SystemExit('runner did not become healthy')
PY

test "$(docker exec "$container" python3 -c 'import os; print(os.getuid())')" = "65532"
test "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$container")" = "true"
test "$(docker network inspect -f '{{.Internal}}' "$network")" = "true"

if docker exec "$container" python3 -c 'import socket; socket.create_connection(("1.1.1.1", 53), .5)' >/dev/null 2>&1; then
  echo "runner unexpectedly reached an external network" >&2
  exit 1
fi

docker exec -i "$container" python3 - <<'PY'
import json, urllib.error, urllib.request
url='http://127.0.0.1:8787/v1/runs'
payload={
  'source':'def count_routes(n):\n    return 2 if n == 2 else 8',
  'packSlug':'forest-of-patience-climbing-stairs',
  'challengeId':'patience-last-jump',
  'mode':'run',
}
def post(data, token=None):
    headers={'content-type':'application/json'}
    if token: headers['authorization']=f'Bearer {token}'
    request=urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)

status, body=post(payload)
assert status == 401, (status, body)
status, body=post(payload, 'ci-runner-token-not-a-production-secret')
assert status == 200 and body.get('passed') is True, (status, body)
payload['source']="def count_routes(n):\n    return 'x' * 400000"
status, body=post(payload, 'ci-runner-token-not-a-production-secret')
assert status == 502 and body.get('code') == 'response_too_large', (status, body)
PY
