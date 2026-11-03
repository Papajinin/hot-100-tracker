// Hot 100 Tracker 화면 v3: data/state.json(매주 GitHub가 고쳐 둠)을 읽어서 보여 주기만 함
// 탭: 지켜보는 중(아직 판정 전 + 작년에서 넘어온 "-" 곡) / 올해의 곡(파란 번호) / 차트 아웃(올해의 곡이 되기 전에 빠진 곡, 빨강)

const appEl = document.getElementById('app');
const TABS = [['watch', '지켜보는 중'], ['song', '올해의 곡'], ['out', '차트 아웃']];
let data = null;
let tab = 'watch';
try { tab = localStorage.getItem('hot100.tab') || 'watch'; } catch (e) {}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// "2026-10-31" → "10/31"
function md(ymd) { return ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : ''; }

function tabSongs(key) {
  const songs = data.songs;
  if (key === 'watch') return songs.filter(s => s.status === 'watch' || s.status === 'carry');
  if (key === 'song') return songs.filter(s => s.status === 'song').sort((a, b) => a.no - b.no);
  return songs.filter(s => s.status === 'out');
}

function rowHtml(s) {
  // 이번 주 순위는 가수 앞에 작게 (차트에 없으면 "차트 아웃"). 가수 이름이 길어도 순위는 보이게
  const where = s.rank ? `${s.rank}위` : '차트 아웃';
  const badge = s.status === 'song' ? `<span class="no">${s.no}</span>`
    : s.status === 'carry' ? `<span class="no carry" title="작년에서 넘어온 곡">-</span>` : '';
  return `<div class="li${s.status === 'out' ? ' dropped' : ''}">
    ${badge}
    <div class="info"><div class="t">${esc(s.title)}</div><div class="a">${s.status === 'out' ? '' : `<span class="where">${where}</span> · `}${esc(s.artist)}</div></div>
    <div class="cnt"><span>Top10</span><b>${s.top10}</b><span>WKS</span><b>${s.wks}</b></div>
  </div>`;
}

function changesHtml() {
  const l = (data.log || [])[0];
  if (!l) return `<div class="changes"><p class="empty">다음 차트부터 여기에 보여요</p></div>`;
  const line = (label, list, cls) => list.length ? `<div class="ch${cls ? ' ' + cls : ''}"><span>${label}</span><p>${list.map(esc).join(', ')}</p></div>` : '';
  const body = line('새로 Top 10', l.newTop10) + line('올해의 곡 됨', l.newSong, 'hi') + line('다시 Top 10', l.revived) + line('차트 아웃', l.dropped, 'red');
  return `<div class="changes">${body || '<p class="empty">바뀐 것이 없어요</p>'}</div>`;
}

function render() {
  if (!data) {
    appEl.innerHTML = `<header class="top"><div class="top-row"><h1 class="logo">HOT 100<small>TRACKER</small></h1></div></header><p class="empty">${data === null ? '불러오는 중…' : '기록을 불러오지 못했어요. 인터넷을 확인해 주세요.'}</p>`;
    return;
  }
  const counts = Object.fromEntries(TABS.map(([k]) => [k, tabSongs(k).length]));
  const list = tabSongs(tab);
  appEl.innerHTML = `
    <header class="top">
      <div class="top-row"><h1 class="logo">HOT 100<small>TRACKER</small></h1><span class="week">${data.year}<b>${md(data.lastChart)}주</b></span></div>
      <div class="tabs">${TABS.map(([k, name]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}">${name} ${counts[k]}</button>`).join('')}</div>
    </header>
    <div class="list">${list.length ? list.map(rowHtml).join('') : '<p class="empty">없어요</p>'}</div>
    ${tab === 'watch' && list.some(s => s.status === 'carry') ? '<p class="note">"-"는 작년에서 넘어온 곡이에요. 횟수는 세지만 올해의 곡은 되지 않아요.</p>' : ''}
    <h2 class="sec-title">이번 주 바뀐 것<span>${md(data.lastChart)}주</span></h2>
    ${changesHtml()}
    <p class="note">매주 수요일 아침에 새 차트로 바뀌어요.</p>`;
}

appEl.addEventListener('click', e => {
  // 곡 줄을 누르면 잘린 제목·가수를 펼쳐 보기 (한 번 더 누르면 접기)
  const li = e.target.closest('.li');
  if (li) { li.classList.toggle('open'); return; }
  const b = e.target.closest('[data-tab]');
  if (!b || b.dataset.tab === tab) return;
  tab = b.dataset.tab;
  try { localStorage.setItem('hot100.tab', tab); } catch (err) {}
  render();
  window.scrollTo(0, 0);
});

function load() {
  fetch('data/state.json?t=' + Date.now(), { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { data = d; render(); })
    .catch(() => { if (!data) { data = false; render(); } });
}

// 앱을 다시 열면(홈 화면에서 돌아오면) 새 기록 받기
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });

// 시작 화면: 첫 화면을 다 그린 뒤에 움직이기 시작 → 약 2초 뒤 사라짐
let splashStarted = false;
function startSplash() {
  if (splashStarted) return;
  splashStarted = true;
  const splash = document.getElementById('splash');
  splash.classList.add('go');
  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 400);
  }, 2000);
}

render();
load();
requestAnimationFrame(() => requestAnimationFrame(startSplash));
setTimeout(startSplash, 1000);
