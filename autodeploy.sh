#!/usr/bin/env bash
# SQUAD CLASH — GitHub 자동 배포를 서울 서비스(squad-clash)로 연결 (Cloud Shell에서 한 번 실행)
# 저장소를 연결할 때 만들어진 Cloud Build 트리거를 찾아, 배포 대상을 squad-clash / asia-northeast3 로 바꾼다.
KEEP=squad-clash; KEEP_REGION=asia-northeast3
PROJECT="$(gcloud config get-value project 2>/dev/null)"
echo "▶ 프로젝트 [$PROJECT]"
gcloud run services describe "$KEEP" --region "$KEEP_REGION" --format='value(status.url)' || { echo "서울 서비스 [$KEEP] 가 없습니다"; exit 1; }

FIXED=""; FIXED_R=""; SEEN=0
for R in global asia-northeast3 europe-west1; do
  echo "== 트리거 목록 ($R)"
  NAMES="$(gcloud builds triggers list --region="$R" --format='value(name)')"
  [ -n "$NAMES" ] || { echo "   (없음)"; continue; }
  for T in $NAMES; do
    SEEN=$((SEEN + 1)); F="$HOME/.sc-trigger-$R-$T.yaml"; rm -f "$F"
    gcloud builds triggers export "$T" --region="$R" --destination="$F" || { echo "   [$T] 내보내기 실패"; continue; }
    echo "   [$T]"; grep -E "^(name|description):|_SERVICE_NAME|_DEPLOY_REGION|repository:|owner:|  name:" "$F" | sed 's/^/      /'
    grep -qi 'squadclash' "$F" || { echo "      → SQUAD CLASH 용이 아니라 건드리지 않음"; continue; }
    grep -q '_SERVICE_NAME' "$F" || { echo "      → 배포 대상 값이 없어 건드리지 않음"; continue; }
    if [ -z "$FIXED" ]; then
      sed -i -E "s/^([[:space:]]*_SERVICE_NAME:[[:space:]]*).*$/\1${KEEP}/; s/^([[:space:]]*_DEPLOY_REGION:[[:space:]]*).*$/\1${KEEP_REGION}/" "$F"
      if gcloud builds triggers import --region="$R" --source="$F"; then echo "      → 서울 서비스로 배포하도록 바꿨습니다"; FIXED="$T"; FIXED_R="$R"; else echo "      → 바꾸지 못했습니다"; fi
    else
      echo "      → 같은 일을 하는 트리거가 이미 있어 삭제"; gcloud builds triggers delete "$T" --region="$R" --quiet
    fi
  done
done

echo
if [ -n "$FIXED" ]; then
  echo "▶ 확인을 위해 지금 한 번 빌드·배포를 시작합니다 (3~5분 뒤 반영)"
  gcloud builds triggers run "$FIXED" --region="$FIXED_R" --branch=main --format='value(metadata.build.id)' || echo "⚠ 빌드를 시작하지 못했습니다"
  echo "✅ 자동 배포 연결 완료: 저장소 main → [$KEEP / $KEEP_REGION]"
else
  echo "⚠ 바꿀 트리거를 찾지 못했습니다 (본 트리거 수: $SEEN). 이 화면을 캡처해서 알려 주세요."
fi
