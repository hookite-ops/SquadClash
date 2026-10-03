#!/usr/bin/env bash
# SQUAD CLASH — 서울 서버 하나만 남기기 (Cloud Shell에서 한 번 실행)
#  1) 서울(asia-northeast3)의 SQUAD CLASH 서비스 설정을 맞춤 (서버 1대 고정 → 같은 방 코드면 꼭 만남)
#  2) 다른 리전에 남아 있는 SQUAD CLASH 서비스를 지움
#  3) 지워진 서비스로 배포하려는 자동 배포 트리거를 지움
# 이름이 squadclash… / squad-clash… 인 서비스만 다루고, 프로젝트의 다른 서비스는 건드리지 않는다.
set -e
KEEP_REGION=asia-northeast3
PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then echo "프로젝트가 선택되지 않았어요:  gcloud config set project 내프로젝트ID"; exit 1; fi
echo "▶ 프로젝트 [$PROJECT]"

mapfile -t SVCS < <(gcloud run services list --format='value(metadata.name,region)' 2>/dev/null | awk '$1 ~ /^(squadclash|squad-clash)/ {print $1" "$2}')
echo "▶ 찾은 서비스:"; printf '   %s\n' "${SVCS[@]}"

# 남길 서비스: 서울에 있는 것 (저장소에서 만든 squadclash 를 먼저)
KEEP=""
for cand in squadclash squad-clash; do
  for line in "${SVCS[@]}"; do [ "$line" = "$cand $KEEP_REGION" ] && KEEP="$cand"; done
  [ -n "$KEEP" ] && break
done
if [ -z "$KEEP" ]; then echo "서울($KEEP_REGION)에 SQUAD CLASH 서비스가 없어서 아무것도 바꾸지 않았습니다."; exit 1; fi

echo "▶ 서울 서비스 [$KEEP] 설정을 맞춥니다 (1분쯤)"
gcloud run services update "$KEEP" --region "$KEEP_REGION" --min-instances 0 --max-instances 1 --concurrency 250 --timeout 3600 --session-affinity --port 8080 --quiet
gcloud run services add-iam-policy-binding "$KEEP" --region "$KEEP_REGION" --member=allUsers --role=roles/run.invoker --quiet >/dev/null 2>&1 || true

URL="$(gcloud run services describe "$KEEP" --region "$KEEP_REGION" --format='value(status.url)')"
[ -n "$URL" ] || { echo "서울 서비스를 확인하지 못해 아무것도 지우지 않았습니다"; exit 1; }

for line in "${SVCS[@]}"; do
  n="${line% *}"; r="${line#* }"
  if [ "$n" = "$KEEP" ] && [ "$r" = "$KEEP_REGION" ]; then continue; fi
  echo "▶ 서비스 [$n / $r] 삭제"
  gcloud run services delete "$n" --region "$r" --quiet || echo "  (지우지 못했습니다)"
done

# 자동 배포 트리거: 서울 서비스로 가는 것만 남김
TRIG_OK=0
for R in global asia-northeast3 europe-west1 asia-northeast1 us-central1; do
  for T in $(gcloud builds triggers list --region="$R" --format='value(name)' 2>/dev/null); do
    F="$(mktemp)"
    gcloud builds triggers export "$T" --region="$R" --destination="$F" --quiet >/dev/null 2>&1 || continue
    grep -qi 'SquadClash' "$F" || continue
    grep -q '_SERVICE_NAME' "$F" || continue
    if grep -Eq "_SERVICE_NAME: ['\"]?${KEEP}['\"]?[[:space:]]*$" "$F" && grep -Eq "_DEPLOY_REGION: ['\"]?${KEEP_REGION}['\"]?[[:space:]]*$" "$F"; then echo "▶ 자동 배포 트리거 [$T] → 서울 서비스 (그대로 둠)"; TRIG_OK=1
    else echo "▶ 지워진 서비스용 트리거 [$T] 삭제"; gcloud builds triggers delete "$T" --region="$R" --quiet >/dev/null 2>&1 || echo "  (지우지 못했습니다)"; fi
  done
done

echo
echo "✅ 남은 게임 주소 (서울):  $URL"
PN="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)' 2>/dev/null || true)"
[ -n "$PN" ] && echo "   같은 서비스의 다른 주소: https://${KEEP}-${PN}.${KEEP_REGION}.run.app"
if [ "$TRIG_OK" = 1 ]; then echo "자동 배포: 저장소 main 에 올라오면 이 서비스로 배포됩니다."; else echo "⚠ 서울 서비스로 가는 자동 배포 트리거를 찾지 못했습니다. 이 화면을 캡처해서 알려 주세요."; fi
