// 규칙 테스트: node tools/test.mjs (GitHub도 매주 차트를 읽기 전에 먼저 돌림)
import assert from 'node:assert/strict';
import { applyWeek, isSongOfYear, findEntry, parseChart } from './chart.mjs';
import fs from 'node:fs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('✓', name); };

// 가짜 차트: [제목, 순위, 주] 목록 → 나머지는 채움곡
function chart(date, list) {
  const entries = Array.from({ length: 100 }, (_, i) => ({ rank: i + 1, title: `Filler ${i + 1}`, artist: 'X', wks: 1, debut: '2026-01-03' }));
  for (const [title, rank, wks, debut] of list) entries[rank - 1] = { rank, title, artist: 'A', wks, debut: debut || '2026-03-07' };
  return { date, entries };
}
const song = (o) => ({ title: 'S', artist: 'A', top10: 1, wks: 1, rank: 5, debut: '2026-03-07', status: 'watch', no: null, ...o });
const base = (songs, o) => ({ year: 2026, lastChart: '2026-10-31', nextNo: 27, songs, log: [], ...o });

test('올해의 곡 조건 4가지', () => {
  assert.equal(isSongOfYear(1, 30), true); assert.equal(isSongOfYear(1, 29), false);
  assert.equal(isSongOfYear(2, 20), true); assert.equal(isSongOfYear(2, 19), false);
  assert.equal(isSongOfYear(3, 10), true); assert.equal(isSongOfYear(3, 9), false);
  assert.equal(isSongOfYear(4, 4), true); assert.equal(isSongOfYear(9, 3), false);
});

test('Top 10이면 Top10 +1, 주는 빌보드 숫자 그대로', () => {
  const st = applyWeek(base([song({ top10: 1, wks: 5 })]), chart('2026-11-07', [['S', 3, 6]]));
  assert.equal(st.songs[0].top10, 2); assert.equal(st.songs[0].wks, 6); assert.equal(st.songs[0].rank, 3);
});

test('11~100위면 주만 바뀜', () => {
  const st = applyWeek(base([song({ top10: 1, wks: 5 })]), chart('2026-11-07', [['S', 40, 6]]));
  assert.equal(st.songs[0].top10, 1); assert.equal(st.songs[0].wks, 6);
});

test('처음 Top 10에 든 곡은 목록 끝에 추가', () => {
  const st = applyWeek(base([]), chart('2026-11-07', [['New', 7, 2]]));
  assert.equal(st.songs.length, 10); // 채움곡 9개 + New
  const s = st.songs.find(x => x.title === 'New');
  assert.deepEqual([s.top10, s.wks, s.status], [1, 2, 'watch']);
  assert.ok(st.log[0].newTop10.includes('New'));
});

test('조건을 넘으면 올해의 곡 + 다음 번호', () => {
  const st = applyWeek(base([song({ top10: 3, wks: 3 })]), chart('2026-11-07', [['S', 2, 4]]));
  assert.equal(st.songs[0].status, 'song'); assert.equal(st.songs[0].no, 27); assert.equal(st.nextNo, 28);
});

test('판정 전에 차트에서 빠지면 탈락', () => {
  const st = applyWeek(base([song()]), chart('2026-11-07', []));
  assert.equal(st.songs[0].status, 'out'); assert.ok(st.log[0].dropped.includes('S'));
});

test('올해의 곡은 차트에서 빠져도 남음', () => {
  const st = applyWeek(base([song({ status: 'song', no: 3 })]), chart('2026-11-07', []));
  assert.equal(st.songs[0].status, 'song'); assert.equal(st.songs[0].rank, null);
});

test('"-" 곡은 조건을 넘어도 번호 없음, 빠지면 탈락', () => {
  let st = applyWeek(base([song({ status: 'carry', top10: 9, wks: 60 })]), chart('2026-11-07', [['S', 2, 61]]));
  assert.equal(st.songs[0].status, 'carry');
  st = applyWeek(st, chart('2026-11-14', []));
  assert.equal(st.songs[0].status, 'out');
});

test('탈락 곡: 11~100위로 돌아오면 그대로, Top 10으로 돌아오면 살림', () => {
  let st = base([song({ status: 'out', before: 'watch', rank: null })]);
  st = applyWeek(st, chart('2026-11-07', [['S', 50, 9]]));
  assert.equal(st.songs[0].status, 'out');
  st = applyWeek(st, chart('2026-11-14', [['S', 8, 10]]));
  assert.equal(st.songs[0].status, 'watch'); assert.equal(st.songs[0].top10, 2);
  assert.ok(st.log[0].revived.includes('S'));
  assert.equal(st.songs.filter(s => s.title === 'S').length, 1); // 새 곡으로 또 넣지 않음
});

test('이미 넣은 주는 다시 넣지 않음', () => {
  const st0 = base([song({ top10: 1 })]);
  const st = applyWeek(st0, chart('2026-10-31', [['S', 1, 9]]));
  assert.equal(st, st0);
});

test('1월 날짜 차트는 기록하지 않음 (새해는 사용자 엑셀로 시작)', () => {
  const st0 = base([song({ status: 'song', no: 5 })], { lastChart: '2026-12-26' });
  const st = applyWeek(st0, chart('2027-01-02', [['S', 3, 30]]));
  assert.equal(st, st0);
});

test('12월 마지막 주 차트는 기록함', () => {
  const st = applyWeek(base([song({ top10: 1 })], { lastChart: '2026-12-19' }), chart('2026-12-26', [['S', 2, 9]]));
  assert.equal(st.lastChart, '2026-12-26'); assert.equal(st.songs[0].top10, 2);
});

test('같은 제목이 두 곡이면 가수로 구분', () => {
  const e = findEntry({ title: 'Golden', artist: 'HUNTR/X' }, [{ rank: 1, title: 'Golden', artist: 'Other' }, { rank: 2, title: 'Golden', artist: 'HUNTR/X: EJAE' }]);
  assert.equal(e.rank, 2);
});

test('빌보드 화면 읽기 (저장해 둔 화면이 있을 때)', () => {
  const f = process.env.CHART_HTML;
  if (!f || !fs.existsSync(f)) return;
  const c = parseChart(fs.readFileSync(f, 'utf8'));
  assert.equal(c.entries.length, 100);
  assert.ok(c.entries.every(e => e.wks > 0 && e.title && e.artist));
});

console.log(`\n${n}개 통과`);
