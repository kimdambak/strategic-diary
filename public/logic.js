// 화면과 무관한 순수 로직. 브라우저와 Node(테스트) 양쪽에서 동작한다.

/** state-model.md 의 시작용 축과 동일하게 맞춘다. */
export const DEFAULT_AXES = [
  { id: 'energy', name: '에너지 / 컨디션', good: '', metric: '예: 기상 시각, 운동 횟수/주', now: 5, goal: 7 },
  { id: 'focus', name: '집중 / 실행력', good: '', metric: '예: 하루 딥워크 시간', now: 5, goal: 7 },
  { id: 'skill', name: '역량 / 학습', good: '', metric: '예: 만든 결과물 수, 학습 시간', now: 5, goal: 7 },
  { id: 'resource', name: '자원 (시간·돈)', good: '', metric: '예: 자유 시간, 저축액', now: 5, goal: 7 },
  { id: 'relation', name: '관계 / 환경', good: '', metric: '예: 의미 있는 대화 횟수/주', now: 5, goal: 7 },
  { id: 'meaning', name: '방향 / 의미', good: '', metric: '예: 주간 리뷰 완료율', now: 5, goal: 7 },
];

export const RESULTS = ['달성', '부분', '미달'];
export const CAUSES = ['의지', '설계', '환경', '우선순위'];

const pad = (n) => String(n).padStart(2, '0');

/** 로컬 시간 기준 YYYY-MM-DD */
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function weekdayKo(d) {
  return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return '늦은 밤이에요. 오늘 하루도 여기까지 오느라 애썼어요.';
  if (h < 12) return '좋은 아침이에요. 오늘은 어떤 모습으로 한 걸음 옮겨 볼까요?';
  if (h < 18) return '오후예요. 의도한 대로 흘러가고 있나요, 아니면 방향을 살짝 틀어 볼까요?';
  return '수고했어요. 오늘 하루를 차분히 돌아볼 시간이에요.';
}

/** 뉴스 제목 → 내 상태 축과의 연결 힌트 (규칙 기반, AI 추론 아님) */
const RULES = [
  { axis: 'resource', words: ['금리', '환율', '물가', '대출', '집값', '부동산', '주식', '코스피', '증시', '경기', '소비', '세금', '월세', '전세', '연봉', '임금'], ask: '이번 주 시간이나 돈 중, 내가 바꿀 수 있는 선택은 무엇일까요?' },
  { axis: 'skill', words: ['AI', '인공지능', '일자리', '고용', '채용', '자동화', '반도체', '개발', '기술', '로봇', '교육', '자격'], ask: '이 변화 속에서 내가 한 가지 익혀 둔다면 무엇이 좋을까요?' },
  { axis: 'energy', words: ['폭염', '한파', '미세먼지', '감염', '독감', '수면', '건강', '의료'], ask: '이 환경에서 내 몸과 컨디션을 지키기 위해 오늘 바꿀 한 가지는요?' },
  { axis: 'resource', words: ['에너지', '전기', '유가', '탄소', '기후', '배출'], ask: '에너지·기후 변화가 내 생활비와 선택에 어떤 영향을 줄까요?' },
  { axis: 'relation', words: ['저출생', '고령', '세대', '가족', '복지', '주거', '노동', '갈등', '사회'], ask: '이 변화가 내 주변 사람들과 환경에는 어떻게 닿아 있을까요?' },
];

/**
 * @param {string} title 뉴스 제목
 * @param {string[]} focusIds 이번 분기 집중 축 id
 * @returns {{axis:string, ask:string, word:string, isFocus:boolean}|null}
 */
export function connectNews(title, focusIds = []) {
  const text = String(title || '');
  const hits = [];
  for (const r of RULES) {
    const word = r.words.find((w) => (w === 'AI' ? /\bAI\b/.test(text) : text.includes(w)));
    if (word) hits.push({ axis: r.axis, ask: r.ask, word, isFocus: focusIds.includes(r.axis) });
  }
  if (!hits.length) return null;
  return hits.find((h) => h.isFocus) || hits[0];
}

export function emptyEntry() {
  return {
    intent: '', firstAction: '', ifThen: '', worldNote: '',
    done: '', result: '', cause: '',
    scores: { energy: '', focus: '', extra: '' },
    learned: '', tomorrow: '',
  };
}

export function isEntryEmpty(e) {
  if (!e) return true;
  const t = ['intent', 'firstAction', 'ifThen', 'worldNote', 'done', 'result', 'cause', 'learned', 'tomorrow'];
  return t.every((k) => !String(e[k] || '').trim()) && Object.values(e.scores || {}).every((v) => v === '' || v == null);
}

/** templates/day.md 형식으로 내보낸다. */
export function toDayMarkdown(key, entry, extraLabel = '기타 (집중 축)') {
  const e = { ...emptyEntry(), ...entry, scores: { ...emptyEntry().scores, ...(entry?.scores || {}) } };
  const mark = (r) => RESULTS.map((x) => `${e.result === x ? '☑' : '☐'} ${x}`).join('  ');
  const s = (v) => (v === '' || v == null ? '' : v);
  const lines = [
    `# ${key} (${weekdayKo(parseDateKey(key))})`,
    '',
  ];
  if (e.worldNote.trim()) lines.push('## 오늘의 세상', e.worldNote.trim(), '');
  lines.push(
    '## 아침: 의도 (3분)',
    `- 오늘 바꿀 한 가지 (주간 목표와 연결): ${e.intent.trim()}`,
    `- 가장 먼저 할 행동 (언제, 어디서): ${e.firstAction.trim()}`,
    `- 방해가 올 만한 것과 대응 (if-then): ${e.ifThen.trim()}`,
    '',
    '## 저녁: 실행 점검 (5분)',
    `- 실제로 한 것: ${e.done.trim()}`,
    `- 의도 달성: ${mark()}`,
    `- 미달이었다면 원인 한 줄 (의지 / 설계 / 환경 / 우선순위): ${e.cause}`,
    '',
    '## 상태 체크 (각 1~10)',
    `| 에너지 | 집중 | ${extraLabel} |`,
    '|---|---|---|',
    `| ${s(e.scores.energy)} | ${s(e.scores.focus)} | ${s(e.scores.extra)} |`,
    '',
    '## 오늘 배운 것 (한 줄)',
    e.learned.trim(),
    '',
    '## 내일의 첫 행동 (한 줄)',
    e.tomorrow.trim(),
    '',
  );
  return lines.join('\n');
}

/** 최근 7일(오늘 포함) 요약 */
export function weekSummary(days, today = new Date()) {
  const out = { recorded: 0, 달성: 0, 부분: 0, 미달: 0 };
  for (let i = 0; i < 7; i++) {
    const e = days[dateKey(addDays(today, -i))];
    if (isEntryEmpty(e)) continue;
    out.recorded += 1;
    if (RESULTS.includes(e.result)) out[e.result] += 1;
  }
  return out;
}

export function gap(axis) {
  const n = Number(axis.now), g = Number(axis.goal);
  if (!Number.isFinite(n) || !Number.isFinite(g)) return 0;
  return g - n;
}
