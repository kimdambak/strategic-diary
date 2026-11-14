import {
  CAUSES, RESULTS, connectNews, dateKey, emptyEntry, gap, greeting,
  isEntryEmpty, parseDateKey, toDayMarkdown, weekSummary, weekdayKo,
} from './logic.js';
import { load, replaceAll, save } from './storage.js';

const store = load();
const main = document.getElementById('main');
const todayKey = dateKey();

/* ---------- 작은 도우미 ---------- */

/** DOM 생성. 외부 문자열은 항상 텍스트 노드로만 넣는다(innerHTML 사용 안 함). */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

let saveTimer;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!save()) toast('저장 공간을 쓸 수 없어요. 내려받기로 따로 보관해 주세요.');
  }, 300);
}

let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

function download(name, text, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('복사했어요');
    return true;
  } catch {
    toast('복사가 막혀 있어요. 내려받기를 이용해 주세요.');
    return false;
  }
}

function field(label, control) {
  return h('label', { class: 'f' }, h('span', {}, label), control);
}

function focusAxes() {
  return store.state.axes.filter((a) => store.state.focus.includes(a.id));
}

/* ---------- 오늘 ---------- */

function getEntry(key) {
  return store.days[key] || emptyEntry();
}

function renderToday() {
  const entry = { ...emptyEntry(), ...getEntry(todayKey), scores: { ...emptyEntry().scores, ...(getEntry(todayKey).scores) } };
  const commit = () => { store.days[todayKey] = entry; saveSoon(); };

  const text = (key, rows = 2, placeholder = '') =>
    h('textarea', {
      rows, placeholder, value: entry[key],
      oninput: (e) => { entry[key] = e.target.value; commit(); },
    });

  const extraLabel = focusAxes()[0]?.name || '기타 (집중 축)';

  const slider = (key, label) => {
    const out = h('b', {}, entry.scores[key] === '' ? '–' : entry.scores[key]);
    const input = h('input', {
      type: 'range', min: 1, max: 10, step: 1, value: entry.scores[key] === '' ? 5 : entry.scores[key],
      'aria-label': label,
      oninput: (e) => { entry.scores[key] = Number(e.target.value); out.textContent = e.target.value; commit(); },
    });
    return h('label', { class: 'slider' }, label, out, input);
  };

  const resultChips = h('div', { class: 'chips', role: 'group', 'aria-label': '의도 달성' },
    RESULTS.map((r) => h('button', {
      type: 'button', class: `chip${entry.result === r ? ' on' : ''}`,
      onclick: (e) => {
        entry.result = entry.result === r ? '' : r;
        resultChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.textContent === entry.result));
        commit();
      },
    }, r)));

  const cause = h('select', {
    onchange: (e) => { entry.cause = e.target.value; commit(); },
  }, h('option', { value: '' }, '선택 안 함'),
    CAUSES.map((c) => h('option', { value: c, selected: entry.cause === c }, c)));

  const worldNote = h('textarea', {
    rows: 2, placeholder: '「세상」 탭에서 담은 변화가 여기에 모여요.', value: entry.worldNote,
    oninput: (e) => { entry.worldNote = e.target.value; commit(); },
  });

  const md = () => toDayMarkdown(todayKey, store.days[todayKey] || entry, extraLabel);

  return h('div', {},
    h('section', { class: 'card' },
      h('h2', {}, '아침 · 오늘의 의도'),
      h('p', { class: 'sub' }, '열심히보다, 오늘 내가 바꿀 단 한 가지를 정해 봐요.'),
      field('오늘 바꿀 한 가지 (주간 목표와 연결)', text('intent', 2, '예: 저녁 대신 아침에 30분 공부하기')),
      field('가장 먼저 할 행동 (언제, 어디서)', text('firstAction', 2, '예: 7시, 책상에 앉자마자 노트 펼치기')),
      field('방해가 올 만한 것과 대응 (if-then)', text('ifThen', 2, '예: 핸드폰이 눈에 띄면 → 서랍에 넣는다')),
      field('오늘의 세상 메모', worldNote),
    ),
    h('section', { class: 'card' },
      h('h2', {}, '저녁 · 오늘을 돌아보기'),
      h('p', { class: 'sub' }, '잘했는지 평가하기보다, 무슨 일이 있었는지 다정하게 살펴봐요.'),
      field('실제로 한 것', text('done', 3)),
      field('의도 달성', resultChips),
      field('미달이었다면 원인 한 줄', cause),
      h('div', { class: 'row3' },
        slider('energy', '에너지'),
        slider('focus', '집중'),
        slider('extra', extraLabel)),
      field('오늘 배운 것 (한 줄)', text('learned', 2)),
      field('내일의 첫 행동 (한 줄)', text('tomorrow', 2)),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => copy(md()) }, '마크다운 복사'),
        h('button', { class: 'btn ghost', onclick: () => download(`${todayKey}.md`, md()) }, '내려받기')),
      h('p', { class: 'sub' }, `내려받은 파일은 저장소의 days/${todayKey}.md 로 올리면 돼요.`),
    ));
}

/* ---------- 나의 상태 ---------- */

function renderState() {
  const st = store.state;
  const rerender = () => { saveSoon(); show('state'); };

  const num = (axis, key) => h('input', {
    type: 'number', min: 1, max: 10, value: axis[key], 'aria-label': `${axis.name} ${key === 'now' ? '현재' : '목표'} 점수`,
    onchange: (e) => {
      const v = Math.min(10, Math.max(1, Number(e.target.value) || 1));
      axis[key] = v;
      rerender();
    },
  });

  const rows = st.axes.map((axis) => {
    const g = gap(axis);
    return h('tr', {},
      h('td', {}, h('input', { type: 'text', value: axis.name, oninput: (e) => { axis.name = e.target.value; saveSoon(); } })),
      h('td', {}, h('input', { type: 'text', value: axis.metric, oninput: (e) => { axis.metric = e.target.value; saveSoon(); } })),
      h('td', {}, num(axis, 'now')),
      h('td', {}, num(axis, 'goal')),
      h('td', {}, h('span', { class: g > 0 ? 'pill' : 'pill ok' }, g > 0 ? `+${g}` : '도달'),
        h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, (Number(axis.now) / 10) * 100)}%` }))),
      h('td', {}, h('button', {
        class: 'btn ghost small', type: 'button', 'aria-label': `${axis.name} 삭제`,
        onclick: () => {
          st.axes = st.axes.filter((a) => a !== axis);
          st.focus = st.focus.filter((id) => id !== axis.id);
          rerender();
        },
      }, '삭제')));
  });

  const focusChips = h('div', { class: 'chips' }, st.axes.map((axis) => h('button', {
    type: 'button', class: `chip${st.focus.includes(axis.id) ? ' on' : ''}`,
    onclick: () => {
      if (st.focus.includes(axis.id)) st.focus = st.focus.filter((id) => id !== axis.id);
      else if (st.focus.length >= 2) return toast('집중 축은 최대 2개까지예요. 다 바꾸려 하면 아무것도 안 바뀌어요.');
      else st.focus = [...st.focus, axis.id];
      rerender();
    },
  }, axis.name)));

  return h('div', {},
    h('section', { class: 'card' },
      h('h2', {}, '나의 상태'),
      h('p', { class: 'sub' }, '지금의 나와 되고 싶은 나를 점수(1~10)로 가볍게 적어 봐요. 평가보다 관찰이에요.'),
      h('table', {},
        h('thead', {}, h('tr', {}, ['축', '측정 방법', '현재', '목표', '간격', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, rows)),
      h('div', { class: 'actions' },
        h('button', {
          class: 'btn ghost small', type: 'button',
          onclick: () => {
            st.axes.push({ id: `custom-${Date.now()}`, name: '새 축', good: '', metric: '', now: 5, goal: 7 });
            rerender();
          },
        }, '축 추가'))),
    h('section', { class: 'card' },
      h('h2', {}, '이번 분기의 집중 축'),
      h('p', { class: 'sub' }, '최대 2개. 여기서 고른 축에 맞춰 세상 브리핑과 배움 추천이 달라져요.'),
      focusChips),
    h('section', { class: 'card' },
      h('h2', {}, '현재와 90일 후'),
      field('현재 상태 (사실 위주로)', h('textarea', { rows: 3, value: st.asIs, oninput: (e) => { st.asIs = e.target.value; saveSoon(); } })),
      field('되고 싶은 상태 (90일 후, 하루가 어떻게 달라지나요?)', h('textarea', { rows: 3, value: st.toBe, oninput: (e) => { st.toBe = e.target.value; saveSoon(); } }))));
}

/* ---------- 세상 ---------- */

const CATEGORY_LABEL = { economy: '경제', society: '사회', environment: '환경', tech: '기술' };

function renderWorld() {
  const box = h('div', {}, h('p', { class: 'empty' }, '오늘의 세상을 불러오는 중이에요…'));

  fetch('/api/briefing')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((data) => box.replaceChildren(...briefingCards(data)))
    .catch(() => box.replaceChildren(h('section', { class: 'card' },
      h('h2', {}, '지금은 세상 소식을 가져오지 못했어요'),
      h('p', { class: 'sub' }, 'Vercel에 배포했거나 `npm run dev`로 실행 중일 때 브리핑이 동작해요. 잠시 후 다시 시도해 주세요.'),
      h('button', { class: 'btn small', onclick: () => show('world') }, '다시 불러오기'))));

  return h('div', {},
    h('section', { class: 'card' },
      h('h2', {}, '오늘의 세상'),
      h('p', { class: 'sub' }, focusAxes().length
        ? `집중 축(${focusAxes().map((a) => a.name).join(', ')})과 닿는 소식에 표시를 해 드려요.`
        : '「나의 상태」에서 집중 축을 정하면, 나와 닿는 소식을 골라 드려요.')),
    box);
}

function briefingCards(data) {
  const focus = store.state.focus;
  const sections = Object.entries(CATEGORY_LABEL).map(([key, label]) => {
    const items = data.items?.[key] || [];
    return h('section', { class: 'card' },
      h('h2', {}, label),
      items.length
        ? h('ul', { class: 'news' }, items.map((it) => newsItem(it, focus)))
        : h('p', { class: 'empty' }, '이 분야 소식을 불러오지 못했어요.'));
  });
  const when = data.updatedAt ? new Date(data.updatedAt).toLocaleString('ko-KR') : '';
  return [...sections, h('p', { class: 'sub' }, when ? `${when} 기준 · 제목과 링크만 보여 드려요. 자세한 내용은 원문에서 확인해 주세요.` : '')];
}

function newsItem(it, focus) {
  const link = connectNews(it.title, focus);
  const axisName = link && store.state.axes.find((a) => a.id === link.axis)?.name;
  return h('li', {},
    h('a', { href: it.link, target: '_blank', rel: 'noopener noreferrer' }, it.title),
    h('div', { class: 'meta' }, [it.source, it.pubDate && new Date(it.pubDate).toLocaleDateString('ko-KR')].filter(Boolean).join(' · ')),
    link && h('div', { class: 'link-note' },
      h('span', { class: 'tag' }, link.isFocus ? '나와 닿아요' : '이런 연결도'),
      `${axisName || '내 상태'} · ${link.ask} `,
      h('button', {
        class: 'btn ghost small', type: 'button',
        onclick: () => {
          const e = { ...emptyEntry(), ...getEntry(todayKey) };
          const line = `- ${it.title} → ${link.ask}`;
          e.worldNote = e.worldNote ? `${e.worldNote}\n${line}` : line;
          store.days[todayKey] = e;
          saveSoon();
          toast('오늘의 세상 메모에 담았어요');
        },
      }, '오늘에 담기')));
}

/* ---------- 배움 ---------- */

function renderLearn() {
  const box = h('div', {}, h('p', { class: 'empty' }, '불러오는 중이에요…'));
  fetch('./data/recommendations.json')
    .then((r) => r.json())
    .then((data) => box.replaceChildren(...learnCards(data)))
    .catch(() => box.replaceChildren(h('p', { class: 'empty' }, '추천 목록을 불러오지 못했어요.')));

  return h('div', {},
    h('section', { class: 'card' },
      h('h2', {}, '더 나은 선택을 위한 배움'),
      h('p', { class: 'sub' }, focusAxes().length
        ? '집중 축에 맞는 이론과 오픈소스를 먼저 보여 드려요.'
        : '「나의 상태」에서 집중 축을 정하면 맞춤으로 보여 드려요. 지금은 모두 보여 드릴게요.')),
    box);
}

function learnCards(data) {
  const focus = store.state.focus;
  const ids = focus.length ? focus : Object.keys(data.axes);
  const blocks = ids.filter((id) => data.axes[id]).map((id) => ({ title: data.axes[id].title, ...data.axes[id] }));
  if (data.general) blocks.push({ title: '모든 선택에 도움이 되는 틀', ...data.general });
  return blocks.map((b) => h('section', { class: 'card' },
    h('h2', {}, b.title),
    b.theories?.length ? h('h3', {}, '이론 · 개념') : null,
    h('ul', { class: 'news' }, (b.theories || []).map((t) => h('li', {},
      h('a', { href: t.url, target: '_blank', rel: 'noopener noreferrer' }, t.name),
      h('div', { class: 'meta' }, t.why)))),
    b.repos?.length ? h('h3', {}, 'GitHub 오픈소스') : null,
    h('ul', { class: 'news' }, (b.repos || []).map((r) => h('li', {},
      h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.name),
      h('div', { class: 'meta' }, r.why),
      r.firstStep && h('div', { class: 'link-note' }, h('span', { class: 'tag' }, '첫 걸음'), r.firstStep))))));
}

/* ---------- 기록 ---------- */

function renderLog() {
  const keys = Object.keys(store.days).filter((k) => !isEntryEmpty(store.days[k])).sort().reverse();
  const w = weekSummary(store.days);
  const extraLabel = focusAxes()[0]?.name || '기타 (집중 축)';

  const fileInput = h('input', {
    type: 'file', accept: 'application/json', hidden: true,
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data || typeof data !== 'object' || (!data.days && !data.state)) throw new Error('형식');
        if (!confirm('지금 기록을 이 파일의 내용으로 바꿀까요? 되돌릴 수 없어요.')) return;
        replaceAll(data);
        toast('불러왔어요');
        show('log');
      } catch {
        toast('이 파일은 읽을 수 없어요. 내려받은 JSON 파일인지 확인해 주세요.');
      }
    },
  });

  return h('div', {},
    h('section', { class: 'card' },
      h('h2', {}, '최근 7일'),
      h('div', { class: 'stats' },
        [['기록한 날', w.recorded], ['달성', w['달성']], ['부분', w['부분']], ['미달', w['미달']]]
          .map(([l, n]) => h('div', { class: 'stat' }, h('b', {}, n), h('span', {}, l)))),
      h('p', { class: 'sub' }, w.recorded
        ? '못 지킨 날은 평가하지 말고 원인만 살펴봐요. 의지 문제인지, 설계 문제인지.'
        : '아직 이번 주 기록이 없어요. 오늘의 한 줄부터 시작해 봐요.')),
    h('section', { class: 'card' },
      h('h2', {}, '지난 기록'),
      keys.length
        ? keys.map((k) => h('div', { class: 'entry' },
          h('span', { class: 'd' }, `${k} (${weekdayKo(parseDateKey(k))})`),
          h('span', { class: 'pill' + (store.days[k].result === '달성' ? ' ok' : '') }, store.days[k].result || '미기록'),
          h('span', { class: 't' }, store.days[k].intent || store.days[k].learned || ''),
          h('button', { class: 'btn ghost small', onclick: () => download(`${k}.md`, toDayMarkdown(k, store.days[k], extraLabel)) }, '.md')))
        : h('p', { class: 'empty' }, '기록이 쌓이면 여기에 보여요.')),
    h('section', { class: 'card' },
      h('h2', {}, '보관하기'),
      h('p', { class: 'sub' }, '이 브라우저를 지우면 기록도 사라져요. 가끔 전체를 내려받아 두면 안심이에요.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => download(`strategic-diary-${todayKey}.json`, JSON.stringify(store, null, 2), 'application/json') }, '전체 내려받기 (JSON)'),
        h('button', { class: 'btn ghost', onclick: () => fileInput.click() }, '불러오기'),
        fileInput)));
}

/* ---------- 라우팅 ---------- */

const VIEWS = { today: renderToday, state: renderState, world: renderWorld, learn: renderLearn, log: renderLog };
let current = 'today';

function show(tab) {
  current = VIEWS[tab] ? tab : 'today';
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === current));
  main.replaceChildren(VIEWS[current]());
  if (location.hash !== `#${current}`) history.replaceState(null, '', `#${current}`);
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) { show(b.dataset.tab); window.scrollTo({ top: 0 }); }
});

const now = new Date();
document.getElementById('date').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${weekdayKo(now)}요일`;
document.getElementById('hello').textContent = greeting(now);
show(location.hash.slice(1) || 'today');
