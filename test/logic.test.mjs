import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, connectNews, dateKey, emptyEntry, gap, isEntryEmpty,
  parseDateKey, toDayMarkdown, weekSummary, weekdayKo,
} from '../public/logic.js';
import { normalize } from '../public/storage.js';

test('dateKey / parseDateKey 는 서로 되돌릴 수 있다', () => {
  assert.equal(dateKey(new Date(2026, 10, 14)), '2026-11-14');
  const d = parseDateKey('2026-01-05');
  assert.equal(dateKey(d), '2026-01-05');
  assert.equal(weekdayKo(parseDateKey('2026-11-14')), '토');
});

test('addDays 는 월 경계를 넘는다', () => {
  assert.equal(dateKey(addDays(new Date(2026, 10, 30), 1)), '2026-12-01');
  assert.equal(dateKey(addDays(new Date(2026, 0, 1), -1)), '2025-12-31');
});

test('connectNews: 키워드가 없으면 null', () => {
  assert.equal(connectNews('오늘의 날씨는 맑음'), null);
  assert.equal(connectNews(''), null);
  assert.equal(connectNews(undefined), null);
});

test('connectNews: 키워드에 맞는 축과 질문을 돌려준다', () => {
  const r = connectNews('기준금리 동결, 환율 하락');
  assert.equal(r.axis, 'resource');
  assert.equal(r.word, '금리');
  assert.equal(r.isFocus, false);
  assert.match(r.ask, /\?$/);
});

test('connectNews: 집중 축과 닿는 연결을 우선한다', () => {
  // "AI 일자리 감소 속 주식 상승" → resource(주식) 와 skill(AI) 둘 다 해당
  const title = 'AI 일자리 감소 속 주식 상승';
  assert.equal(connectNews(title, []).axis, 'resource'); // 규칙 순서상 첫 번째
  const r = connectNews(title, ['skill']);
  assert.equal(r.axis, 'skill');
  assert.equal(r.isFocus, true);
});

test('connectNews: AI 는 단어로만 인식하고 영문 단어 일부는 무시한다', () => {
  assert.equal(connectNews('AI가 바꾸는 세상')?.axis, 'skill');
  assert.equal(connectNews('Said the chair maid'), null);
});

test('gap: 숫자가 아니면 0', () => {
  assert.equal(gap({ now: 4, goal: 7 }), 3);
  assert.equal(gap({ now: 8, goal: 7 }), -1);
  assert.equal(gap({ now: '', goal: 7 }), 7); // Number('') === 0
  assert.equal(gap({ now: 'abc', goal: 7 }), 0);
});

test('isEntryEmpty', () => {
  assert.equal(isEntryEmpty(undefined), true);
  assert.equal(isEntryEmpty(emptyEntry()), true);
  assert.equal(isEntryEmpty({ ...emptyEntry(), intent: '  ' }), true);
  assert.equal(isEntryEmpty({ ...emptyEntry(), intent: '공부' }), false);
  assert.equal(isEntryEmpty({ ...emptyEntry(), scores: { energy: 6, focus: '', extra: '' } }), false);
});

test('toDayMarkdown: templates/day.md 형식으로 내보낸다', () => {
  const md = toDayMarkdown('2026-11-14', {
    intent: '아침 30분 공부', result: '부분', cause: '설계',
    scores: { energy: 6, focus: 7, extra: '' }, worldNote: '- 금리 → 질문',
  }, '역량 / 학습');
  assert.match(md, /^# 2026-11-14 \(토\)/);
  assert.match(md, /## 오늘의 세상\n- 금리 → 질문/);
  assert.match(md, /- 오늘 바꿀 한 가지 \(주간 목표와 연결\): 아침 30분 공부/);
  assert.match(md, /☐ 달성  ☑ 부분  ☐ 미달/);
  assert.match(md, /\| 에너지 \| 집중 \| 역량 \/ 학습 \|/);
  assert.match(md, /\| 6 \| 7 \|  \|/);
});

test('toDayMarkdown: 세상 메모가 없으면 해당 섹션을 만들지 않는다', () => {
  assert.doesNotMatch(toDayMarkdown('2026-11-14', {}), /오늘의 세상/);
});

test('weekSummary: 최근 7일만 센다', () => {
  const today = new Date(2026, 10, 14);
  const days = {
    '2026-11-14': { ...emptyEntry(), intent: 'a', result: '달성' },
    '2026-11-13': { ...emptyEntry(), intent: 'b', result: '미달' },
    '2026-11-12': { ...emptyEntry(), intent: 'c' }, // 결과 미기록
    '2026-11-07': { ...emptyEntry(), intent: 'd', result: '달성' }, // 7일 밖
    '2026-11-11': emptyEntry(), // 비어 있음
  };
  assert.deepEqual(weekSummary(days, today), { recorded: 3, 달성: 1, 부분: 0, 미달: 1 });
});

test('normalize: 손상된 데이터도 기본값으로 채운다', () => {
  for (const bad of [null, undefined, 'x', 3, [], {}, { state: 1 }, { state: { axes: 'no' } }]) {
    const s = normalize(bad);
    assert.ok(s.state.axes.length > 0);
    assert.deepEqual(s.state.focus, []);
    assert.equal(typeof s.days, 'object');
  }
  assert.equal(normalize({ state: { focus: ['a', 'b', 'c'] } }).state.focus.length, 2);
});
