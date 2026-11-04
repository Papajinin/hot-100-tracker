// Hot 100 Tracker: 빌보드 HOT 100 기록 규칙 (매주 GitHub가 update.mjs로 돌리고, 테스트도 이 파일을 씀)
// - 빌보드 차트 화면(HTML)에서 순위·곡·가수·차트인 주(WKS)·첫 차트인 날짜·지난주 순위(LW)를 읽음
// - 한 번이라도 Top 10에 든 곡만 기록. 규칙은 plan/plan.md 참고

const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

function clean(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&#0?39;|&#8217;|&rsquo;/g, "'").replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/\s+/g, ' ').trim();
}

// "06/13/26" → "2026-06-13"
function usDate(s) {
  const m = /^(\d\d)\/(\d\d)\/(\d\d)$/.exec(s || '');
  if (!m) return null;
  const y = Number(m[3]) + (Number(m[3]) > 50 ? 1900 : 2000);
  return `${y}-${m[1]}-${m[2]}`;
}

// 차트 화면 → { date: "2026-10-31", entries: [{ rank, title, artist, wks, debut, lw }] }. 이상하면 null
// lw: 지난주 순위 숫자, 새로 진입이면 'NEW', 재진입이면 'RE' (빌보드는 둘 다 "-", 주가 1이면 새로 진입)
export function parseChart(page) {
  const w = /Week of ([A-Z][a-z]+) (\d{1,2}), (\d{4})/.exec(page);
  if (!w || !MONTHS[w[1]]) return null;
  const date = `${w[3]}-${String(MONTHS[w[1]]).padStart(2, '0')}-${w[2].padStart(2, '0')}`;
  const rows = page.split('class="o-chart-results-list-row-container"').slice(1);
  const entries = rows.map((r, i) => {
    const t = /id="title-of-a-story"[^>]*>([\s\S]*?)<\/h3>\s*<span[^>]*>([\s\S]*?)<\/span>/.exec(r);
    // 칸 이름(WEEKS ON CHART, Debut Chart Date) 바로 뒤의 숫자를 읽음
    const after = name => {
      const k = typeof name === 'string' ? r.indexOf(name) : r.search(name);
      if (k < 0) return null;
      const m = /class="c-label[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(r.slice(k));
      return m ? clean(m[1]) : null;
    };
    return t && {
      rank: i + 1,
      title: clean(t[1]),
      artist: clean(t[2]),
      wks: parseInt(after('WEEKS ON CHART'), 10),
      debut: usDate(after('Debut Chart Date')),
      lw: null,
    };
  });
  // 지난주 순위: 칸 이름 "LW" 바로 뒤
  rows.forEach((r, i) => {
    const e = entries[i]; if (!e) return;
    const k = r.search(/>\s*LW\s*</);
    const m = k >= 0 && /class="c-label[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(r.slice(k + 1));
    const v = m ? clean(m[1]) : '';
    e.lw = /^\d+$/.test(v) ? Number(v) : e.wks === 1 ? 'NEW' : 'RE';
  });
  if (entries.length !== 100 || entries.some(e => !e || !e.title || !(e.wks > 0))) return null;
  return { date, entries };
}

// 같은 곡인지 비교할 때: 대소문자·기호·띄어쓰기 무시
export function norm(s) {
  return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

// 기록 목록의 곡 → 이번 차트에서 찾기 (제목이 같고, 가수 이름이 겹치는 곡)
export function findEntry(song, entries) {
  const same = entries.filter(e => norm(e.title) === norm(song.title));
  if (same.length <= 1) return same[0] || null;
  const first = norm(song.artist.split(/ & | Featuring | With |, /)[0]);
  return same.find(e => norm(e.artist).includes(first)) || same[0];
}

// 올해의 곡 조건: Top10 1번+30주, 2번+20주, 3번+10주, 4번 이상+4주
export function isSongOfYear(top10, wks) {
  return (top10 >= 1 && wks >= 30) || (top10 >= 2 && wks >= 20) || (top10 >= 3 && wks >= 10) || (top10 >= 4 && wks >= 4);
}

// 다음 해 차트인지 (12월 날짜 차트까지만 기록. 연말엔 캐롤이 차트를 채워서
// 새해는 사용자가 1월 2주차쯤 새 엑셀을 주면 그걸로 기록 파일을 새로 만듦)
export function isNextYear(state, date) {
  return Number(date.slice(0, 4)) > state.year;
}

// 한 주 차트 넣기. 이미 넣은 주, 지난 주, 다음 해 차트면 그대로 돌려줌
export function applyWeek(state, chart) {
  if (state.lastChart && chart.date <= state.lastChart) return state;
  if (isNextYear(state, chart.date)) return state;
  const st = state;

  const log = { chart: chart.date, newTop10: [], newSong: [], dropped: [], revived: [] };
  const songs = st.songs.map(s => ({ ...s }));
  let nextNo = st.nextNo;
  const used = new Set();

  for (const s of songs) {
    const e = findEntry(s, chart.entries);
    if (e) used.add(e.rank);
    // 차트에서 빠지는 주: 마지막 순위와 그 주를 적어 둠 (앱에 "마지막 23위 · 10/24주")
    if (!e && s.rank) { s.lastRank = s.rank; s.lastWeek = st.lastChart; }
    if (s.status === 'out') {
      // 탈락한 곡은 Top 10에 다시 들어올 때만 살림 (11~100위로 돌아오면 그대로 탈락)
      if (e && e.rank <= 10) {
        s.status = s.before || 'watch';
        delete s.before;
        s.top10++; s.wks = e.wks; s.rank = e.rank; s.lw = e.lw; s.debut = e.debut || s.debut;
        log.revived.push(s.title);
      } else {
        // 11~100위면 횟수는 안 세고 지금 순위만 (앱에 "지금 39→34위")
        s.rank = e ? e.rank : null;
        s.lw = e ? e.lw : null;
      }
      continue;
    }
    if (e) {
      s.wks = e.wks;
      s.rank = e.rank;
      s.lw = e.lw;
      s.debut = e.debut || s.debut;
      if (e.rank <= 10) s.top10++;
    } else {
      s.rank = null;
      s.lw = null;
      // 올해의 곡은 차트에서 빠져도 그대로 남음. 아니면 탈락
      if (s.status !== 'song') {
        s.before = s.status;
        s.status = 'out';
        log.dropped.push(s.title);
      }
    }
  }

  // 처음 Top 10에 든 곡 추가
  for (const e of chart.entries) {
    if (e.rank > 10 || used.has(e.rank)) continue;
    songs.push({ title: e.title, artist: e.artist, top10: 1, wks: e.wks, rank: e.rank, lw: e.lw, debut: e.debut, status: 'watch', no: null, since: chart.date });
    log.newTop10.push(e.title);
  }

  // 올해의 곡 판정 (조건을 넘은 순서대로 번호)
  for (const s of songs) {
    if (s.status === 'watch' && isSongOfYear(s.top10, s.wks)) {
      s.status = 'song';
      s.no = nextNo++;
      log.newSong.push(s.title);
    }
  }

  return { ...st, lastChart: chart.date, nextNo, songs, log: [log, ...(st.log || [])].slice(0, 60) };
}

// 다음 차트 날짜 (7일 뒤)
export function nextDate(ymd) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}
