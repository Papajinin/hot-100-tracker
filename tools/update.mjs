// 매주 GitHub가 돌리는 차트 읽기 (.github/workflows/weekly.yml)
// 마지막으로 넣은 주의 다음 주부터 차례로 읽어서, 아직 안 나온 주가 나오면 멈춤
// (한 주를 놓쳐도 다음 번에 빠진 주부터 채움). 12월 날짜 차트까지만
// 사용법 (ain-chart 폴더에서): node tools/update.mjs
import fs from 'node:fs';
import { parseChart, applyWeek, nextDate, isNextYear } from './chart.mjs';

const FILE = new URL('../data/state.json', import.meta.url);
let state = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const before = state.lastChart;

for (let date = nextDate(state.lastChart); ; date = nextDate(date)) {
  if (isNextYear(state, date)) { console.log(`${date}: 다음 해 차트라 기록 안 함 (새해 엑셀 기다리는 중)`); break; }
  const res = await fetch(`https://www.billboard.com/charts/hot-100/${date}/`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const page = res.ok ? await res.text() : '';
  if (!page.includes('Week of ')) { console.log(`${date}: 아직 안 나옴`); break; }
  const chart = parseChart(page);
  if (!chart || chart.date !== date) throw new Error(`${date}: 차트를 제대로 읽지 못함`); // 화면 모양이 바뀌었을 때 → 실패 메일
  state = applyWeek(state, chart);
  const l = state.log[0];
  console.log(`${date}: 새 Top10 ${l.newTop10.length} · 올해의 곡 ${l.newSong.length} · 탈락 ${l.dropped.length} · 살아남 ${l.revived.length}`);
}

if (state.lastChart !== before) {
  state.updated = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(state, null, 1) + '\n');
}
