#!/usr/bin/env bash
# SQUAD CLASH — 서울 서버 하나만 남기기 (Cloud Shell에서 한 번 실행)
#  1) 지금 저장소에서 빌드된 최신 버전을 서울 서비스 squad-clash 에 올림
#  2) GitHub 자동 배포(Cloud Build 트리거)가 서울 서비스로 가도록 바꿈
#  3) 다른 리전에 만들어진 SQUAD CLASH 서비스를 지움
set -e
KEEP=squad-clash; KEEP_REGION=asia-northeast3
PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then echo "프로젝트가 선택되지 않았어요:  gcloud config set project 내프로젝트ID"; exit 1; fi
echo "▶ 프로젝트 [$PROJECT]"

# 이 프로젝트의 SQUAD CLASH 서비스들 (이름이 squadclash… 또는 squad-clash… 인 것만 다룸)
mapfile -t SVCS < <(gcloud run services list --format='value(metadata.name,metadata.labels."cloud.googleapis.com/location")' 2>/dev/null | awk '$1 ~ /^(squadclash|squad-clash)/ {print $1" "$2}')
echo "▶ 찾은 서비스:"; printf '   %s\n' "${SVCS[@]}"

# 1) 저장소에서 자동 배포된 서비스의 최신 이미지를 찾아 서울에 올림
IMG=""; SRC=""; SRC_REGION=""
for line in "${SVCS[@]}"; do
  n="${line% *}"; r="${line#* }"
  if [ "$n" = "$KEEP" ] && [ "$r" = "$KEEP_REGION" ]; then continue; fi
  i="$(gcloud run services describe "$n" --region "$r" --format='value(spec.template.spec.containers[0].image)' 2>/dev/null || true)"
  if [ -n "$i" ]; then IMG="$i"; SRC="$n"; SRC_REGION="$r"; fi
done
if [ -n "$IMG" ]; then
  echo "▶ 최신 버전($SRC / $SRC_REGION)을 서울 서비스 [$KEEP] 에 올립니다 (1~2분)"
  gcloud run deploy "$KEEP" --image "$IMG" --region "$KEEP_REGION" --allow-unauthenticated --port 8080 \
    --cpu 1 --memory 512Mi --min-instances 0 --max-instances 1 --concurrency 250 --timeout 3600 --session-affinity --quiet
else
  echo "▶ 다른 리전 서비스가 없어서 서울 서비스 설정만 맞춥니다"
  gcloud run services update "$KEEP" --region "$KEEP_REGION" --min-instances 0 --max-instances 1 --concurrency 250 --timeout 3600 --session-affinity --port 8080 --quiet
fi

# 2) 자동 배포 트리거를 서울 서비스로 돌림
TRIG_OK=0
for R in global europe-west1 asia-northeast3 asia-northeast1 us-central1 $SRC_REGION; do
  for T in $(gcloud builds triggers list --region="$R" --format='value(name)' 2>/dev/null); do
    F="$(mktemp)"
    gcloud builds triggers export "$T" --region="$R" --destination="$F" --quiet >/dev/null 2>&1 || continue
    grep -qi 'SquadClash' "$F" || continue
    if grep -Eq "_SERVICE_NAME: ['\"]?${KEEP}['\"]?[[:space:]]*$" "$F" && grep -Eq "_DEPLOY_REGION: ['\"]?${KEEP_REGION}['\"]?[[:space:]]*$" "$F"; then echo "▶ 트리거 [$T] 는 이미 서울 서비스로 배포합니다"; TRIG_OK=1; continue; fi
    sed -i -E "s/^([[:space:]]*_SERVICE_NAME:[[:space:]]*).*$/\1${KEEP}/; s/^([[:space:]]*_DEPLOY_REGION:[[:space:]]*).*$/\1${KEEP_REGION}/" "$F"
    if gcloud builds triggers import --region="$R" --source="$F" --quiet >/dev/null 2>&1; then echo "▶ 자동 배포 트리거 [$T] 를 서울 서비스로 바꿨습니다"; TRIG_OK=1; else echo "⚠ 트리거 [$T] 를 바꾸지 못했습니다"; fi
  done
done

# 3) 서울 서비스가 떠 있는 것을 확인한 뒤, 나머지 SQUAD CLASH 서비스를 지움
URL="$(gcloud run services describe "$KEEP" --region "$KEEP_REGION" --format='value(status.url)')"
[ -n "$URL" ] || { echo "서울 서비스를 확인하지 못해 아무것도 지우지 않았습니다"; exit 1; }
for line in "${SVCS[@]}"; do
  n="${line% *}"; r="${line#* }"
  if [ "$n" = "$KEEP" ] && [ "$r" = "$KEEP_REGION" ]; then continue; fi
  echo "▶ 서비스 [$n / $r] 삭제"
  gcloud run services delete "$n" --region "$r" --quiet
done

echo
echo "✅ 남은 게임 주소 (서울):"
gcloud run services list --format='table(metadata.name,metadata.labels."cloud.googleapis.com/location",status.url)' 2>/dev/null | awk 'NR==1 || $1 ~ /^(squadclash|squad-clash)/'
if [ "$TRIG_OK" = 1 ]; then echo "자동 배포: 저장소 main 에 올라오면 서울 서비스로 배포됩니다."; else echo "⚠ 자동 배포 트리거를 찾지 못했습니다. 이 화면을 캡처해서 알려 주세요."; fi
