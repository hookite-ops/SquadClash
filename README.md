# SQUAD CLASH (스쿼드 클래시)

모바일 브라우저에서 바로 하는 멀티플레이 FPS — 폭탄전 · 팀 데스매치 · 생존전.
Node.js(ws) 서버 한 개와 Three.js 화면으로 이루어져 있고, Google Cloud Run 에 올려서 씁니다.

- 맵: 사막 마을 · 부두 야적장 · 기차역 · 옛 성 · 도심 교차로(밤) + 생존전용 외딴 섬
- 내 컴퓨터에서 실행: `npm install && npm start` → http://localhost:8080
- 배포·조작·모드 설명: [배포방법.txt](배포방법.txt)

## 자동 배포

`main` 브랜치에 올라오면 Cloud Run 이 `Dockerfile` 로 빌드해 서울(asia-northeast3)의 `squadclash` 서비스에 배포합니다.
게임 주소: https://squadclash-394173969859.asia-northeast3.run.app
