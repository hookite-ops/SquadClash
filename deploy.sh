#!/usr/bin/env bash
# SQUAD CLASH → Google Cloud Run 배포 (Cloud Shell에서 실행)
set -e
cd "$(dirname "$0")"
REGION="${REGION:-asia-northeast3}"   # 서울
PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then
  echo "프로젝트가 선택되지 않았어요. 아래처럼 먼저 실행해 주세요:"
  echo "  gcloud config set project 내프로젝트ID"
  exit 1
fi
echo "▶ 프로젝트 [$PROJECT] / 리전 [$REGION] 에 배포합니다 (3~5분)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# 새 프로젝트는 빌드용 서비스 계정에 권한이 없어 403(storage.objects.get)이 납니다 → 권한 부여
PN="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA="${PN}-compute@developer.gserviceaccount.com"
if ! gcloud projects get-iam-policy "$PROJECT" --flatten='bindings[].members' \
     --filter="bindings.role=roles/run.builder AND bindings.members=serviceAccount:${SA}" \
     --format='value(bindings.role)' | grep -q run.builder; then
  echo "▶ 빌드 권한(Cloud Run Builder)을 부여합니다"
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:${SA}" \
    --role="roles/run.builder" --condition=None --quiet >/dev/null
  echo "  권한이 적용될 때까지 60초 기다립니다…"
  sleep 60
fi

deploy() {
gcloud run deploy squad-clash \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 --memory 512Mi \
  --min-instances 0 --max-instances 1 \
  --concurrency 250 \
  --timeout 3600 \
  --session-affinity \
  --quiet
}
if ! deploy; then
  echo "▶ 권한 적용이 늦을 수 있어 60초 뒤 한 번 더 시도합니다…"
  sleep 60
  deploy
fi
echo
echo "✅ 완료! 아래 주소를 폰 브라우저에서 열면 됩니다:"
gcloud run services describe squad-clash --region "$REGION" --format 'value(status.url)'
