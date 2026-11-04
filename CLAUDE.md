# Hot 100 Tracker 인계서

> 공통 규칙은 상위 폴더 `../CLAUDE.md`. 기획·규칙은 `plan/plan.md`, 결정은 `plan/decisions.md`

- **무엇:** 빌보드 HOT 100에서 한 번이라도 Top 10에 든 곡의 Top10 횟수·차트인 주를 매주 자동 기록. 사용자(아빠) 혼자 보는 **개인 앱 (가족 AIN 앱 아님, AIN 디자인 규칙 안 따름)**
- **어떻게:** GitHub Actions(`.github/workflows/weekly.yml`)가 한국 수·목·금 아침 9시·오후 3시에 `tools/update.mjs` 실행 → `data/state.json`을 고쳐 커밋. 앱은 그 파일을 읽기만 함
- **버전:** 올릴 때마다 `index.html`의 `APP_VERSION`과 `version.txt`를 같이 올림. 지금 2. (`data/state.json`만 바뀔 때는 안 올려도 됨 — 앱이 매번 새로 받음)
- **테스트:** `node tools/test.mjs` (규칙 14개). 규칙을 고치면 테스트도 같이
- **빌보드 화면이 바뀌면:** `tools/chart.mjs`의 `parseChart`만 고치면 됨. 칸 이름 `WEEKS ON CHART`, `Debut Chart Date` 바로 뒤 숫자를 읽음
- **새해:** 12월 날짜 차트까지만 자동. 1월 2주차쯤 사용자가 새해 엑셀을 주면 `data/state.json`을 새로 만듦
- **기록을 손으로 고칠 때:** `data/state.json`을 고쳐 올림 (GitHub가 고친 최신 파일을 먼저 받아서 고칠 것: `git pull`)
