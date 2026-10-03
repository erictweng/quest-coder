#!/usr/bin/env bash
# Deploys the Quest Coder Python runner to Google Cloud Run.
# Run from the repository root in Google Cloud Shell (gcloud is preinstalled and logged in):
#
#   gcloud projects list                        # copy the PROJECT_ID column (not the name)
#   gcloud config set project <project-id>
#   scripts/deploy_runner_cloud_run.sh
#
# Safe to re-run: it reuses existing secrets, and redeploys the current commit.
#   ROTATE_PACK=1   draw a new set of hidden test cases
#   ROTATE_TOKEN=1  issue a new runner token (then update QUEST_CODER_RUNNER_TOKEN in Vercel)
#   REGION=...      defaults to us-west1 (close to Vercel's sfo1)
#
# The hidden test pack and the token go straight into Secret Manager. Neither is printed or committed.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-west1}"
SERVICE="quest-coder-runner"
REPOSITORY="quest-coder"
PACK_SECRET="quest-coder-private-pack"
TOKEN_SECRET="quest-coder-runner-token"
RUNNER_SA_NAME="quest-coder-runner"
BUILD_SA_NAME="quest-coder-builder"

[ -n "$PROJECT_ID" ] || { echo "Set a project first: gcloud config set project <project-id>" >&2; exit 1; }
[ -f runner/service/Dockerfile ] || { echo "Run this from the quest-coder repository root." >&2; exit 1; }
if ! gcloud projects describe "$PROJECT_ID" --format 'value(projectId)' >/dev/null 2>&1; then
  echo "Project '${PROJECT_ID}' was not found or you cannot access it." >&2
  echo "Find the PROJECT_ID column with: gcloud projects list" >&2
  echo "Then run: gcloud config set project <project-id> && $0" >&2
  exit 1
fi
billing_enabled="$(gcloud billing projects describe "$PROJECT_ID" --format 'value(billingEnabled)' 2>/dev/null || true)"
if [ "$billing_enabled" = "False" ]; then
  echo "Billing is not enabled on '${PROJECT_ID}'. Cloud Run requires a billing account (usage here should stay in the free tier)." >&2
  echo "Enable it at https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID} and re-run." >&2
  exit 1
elif [ "$billing_enabled" != "True" ]; then
  echo "Could not confirm billing on '${PROJECT_ID}'; continuing. If enabling APIs fails, link a billing account first." >&2
fi

RUNNER_SA="${RUNNER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/runner:$(git rev-parse --short HEAD)"
step() { printf '\n==> %s\n' "$*"; }

step "Project ${PROJECT_ID}, region ${REGION}"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com compute.googleapis.com --project "$PROJECT_ID"

step "Artifact Registry repository"
gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$REPOSITORY" --repository-format docker --location "$REGION" --project "$PROJECT_ID"

step "Runner service account (no project roles; can read only its two secrets)"
gcloud iam service-accounts describe "$RUNNER_SA" --project "$PROJECT_ID" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "$RUNNER_SA_NAME" --display-name "Quest Coder runner" --project "$PROJECT_ID"

ensure_secret() { gcloud secrets describe "$1" --project "$PROJECT_ID" >/dev/null 2>&1 || gcloud secrets create "$1" --replication-policy automatic --project "$PROJECT_ID" >/dev/null; }
has_version() { [ -n "$(gcloud secrets versions list "$1" --project "$PROJECT_ID" --filter state=enabled --limit 1 --format 'value(name)' 2>/dev/null)" ]; }

step "Hidden test pack"
ensure_secret "$PACK_SECRET"
if [ "${ROTATE_PACK:-0}" = "1" ] || ! has_version "$PACK_SECRET"; then
  workdir="$(mktemp -d)"; trap 'rm -rf "$workdir"' EXIT
  python3 scripts/private_pack.py generate-cases "$workdir/pack.json"
  gcloud secrets versions add "$PACK_SECRET" --data-file "$workdir/pack.json" --project "$PROJECT_ID" >/dev/null
  rm -f "$workdir/pack.json"
  echo "Stored a new pack version in Secret Manager (${PACK_SECRET})."
else
  echo "Reusing the existing pack (set ROTATE_PACK=1 to draw new cases)."
fi

step "Runner token"
ensure_secret "$TOKEN_SECRET"
if [ "${ROTATE_TOKEN:-0}" = "1" ] || ! has_version "$TOKEN_SECRET"; then
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets versions add "$TOKEN_SECRET" --data-file - --project "$PROJECT_ID" >/dev/null
  echo "Stored a new token in Secret Manager (${TOKEN_SECRET}). Update QUEST_CODER_RUNNER_TOKEN in Vercel."
else
  echo "Reusing the existing token (set ROTATE_TOKEN=1 to rotate)."
fi
for secret in "$PACK_SECRET" "$TOKEN_SECRET"; do
  gcloud secrets add-iam-policy-binding "$secret" --member "serviceAccount:${RUNNER_SA}" \
    --role roles/secretmanager.secretAccessor --project "$PROJECT_ID" >/dev/null
done

step "Outbound-network deny (Direct VPC egress through a network with no NAT)"
if ! gcloud compute networks subnets describe default --region "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "No 'default' subnet in ${REGION}. Create the default VPC (gcloud compute networks create default --subnet-mode auto) and re-run." >&2
  exit 1
fi
if gcloud compute routers list --project "$PROJECT_ID" --filter "region:${REGION}" --format 'value(nats)' 2>/dev/null | grep -q .; then
  echo "A Cloud NAT exists in ${REGION}; the runner would be able to reach the internet. Remove it or use another region." >&2
  exit 1
fi

step "Build image ${IMAGE}"
# New projects run Cloud Build as the Compute Engine default account, which has no roles and
# cannot read the uploaded source. Use a dedicated build account with only the builder role.
BUILD_SA="${BUILD_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts describe "$BUILD_SA" --project "$PROJECT_ID" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "$BUILD_SA_NAME" --display-name "Quest Coder image builder" --project "$PROJECT_ID"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:${BUILD_SA}" \
  --role roles/cloudbuild.builds.builder --condition None >/dev/null
built=0
for attempt in 1 2 3; do
  if gcloud builds submit --config runner/service/cloudbuild.yaml --substitutions "_IMAGE=${IMAGE}" \
      --service-account "projects/${PROJECT_ID}/serviceAccounts/${BUILD_SA}" --project "$PROJECT_ID" .; then
    built=1; break
  fi
  # New IAM grants can take a minute to apply.
  [ "$attempt" -lt 3 ] && { echo "Build failed (attempt ${attempt}/3); waiting 45s for permissions to apply..." >&2; sleep 45; }
done
[ "$built" = 1 ] || { echo "Image build failed after 3 attempts." >&2; exit 1; }

step "Deploy ${SERVICE}"
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" --region "$REGION" --project "$PROJECT_ID" \
  --service-account "$RUNNER_SA" \
  --execution-environment gen2 --port 8787 \
  --cpu 1 --memory 512Mi --concurrency 4 --min-instances 0 --max-instances 3 --timeout 15 --cpu-boost \
  --network default --subnet default --vpc-egress all-traffic \
  --allow-unauthenticated \
  --set-env-vars "QUEST_CODER_RUNNER_HOST=0.0.0.0,QUEST_CODER_PRIVATE_PACK_PATH=/secrets/pack/private-pack.json" \
  --set-secrets "/secrets/pack/private-pack.json=${PACK_SECRET}:latest,QUEST_CODER_RUNNER_TOKEN=${TOKEN_SECRET}:latest"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)')"

step "Smoke test ${URL}"
TOKEN="$(gcloud secrets versions access latest --secret "$TOKEN_SECRET" --project "$PROJECT_ID")"
RUNNER_URL="$URL" RUNNER_TOKEN="$TOKEN" python3 - <<'PY'
import json, os, urllib.error, urllib.request
url, token = os.environ["RUNNER_URL"], os.environ["RUNNER_TOKEN"]
def call(path, body=None, auth=True):
    headers = {"content-type": "application/json"}
    if auth: headers["authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url + path, data=None if body is None else json.dumps(body).encode(), headers=headers, method="GET" if body is None else "POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response: return response.status, json.load(response)
    except urllib.error.HTTPError as error: return error.code, {}
correct = "class Solution:\n    def climbStairs(self, n: int) -> int:\n        a, b = 1, 1\n        for _ in range(2, n + 1):\n            a, b = b, a + b\n        return b\n"
hardcoded = "class Solution:\n    def climbStairs(self, n: int) -> int:\n        return {2: 2, 5: 8}.get(n, 0)\n"
run = lambda source, mode, auth=True: call("/v1/runs", {"source": source, "packSlug": "forest-of-patience-climbing-stairs", "challengeId": "boss-old-bramblehorn", "mode": mode}, auth)
checks = [
    ("health", call("/healthz", auth=False)[0] == 200),
    ("no token is rejected", run(correct, "run", auth=False)[0] == 401),
    ("correct solution passes Submit", run(correct, "submit")[1].get("passed") is True),
    ("hard-coded examples pass Run", run(hardcoded, "run")[1].get("passed") is True),
    ("hard-coded examples fail Submit", run(hardcoded, "submit")[1].get("passed") is False),
]
for name, ok in checks: print(("PASS " if ok else "FAIL ") + name)
raise SystemExit(0 if all(ok for _, ok in checks) else 1)
PY
unset TOKEN

cat <<EOF

Runner is live: ${URL}

Next, in Vercel → quest-coder → Settings → Environment Variables (Production):
  QUEST_CODER_RUNNER_URL   = ${URL}
  QUEST_CODER_RUNNER_TOKEN = (mark Sensitive) value from:
      gcloud secrets versions access latest --secret ${TOKEN_SECRET} --project ${PROJECT_ID}
Then redeploy, and check https://quest-coder.vercel.app/api/health shows "runner":{"available":true}.
EOF
