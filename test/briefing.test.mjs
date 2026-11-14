import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { FEEDS, parseRss } from '../api/briefing.js';

const rss = (items) => `<?xml version="1.0"?><rss><channel>${items.join('')}</channel></rss>`;
const item = ({ title, link = 'https://example.com/a', source = '', pubDate = 'Sat, 14 Nov 2026 02:00:00 GMT' }) =>
  `<item><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate>${source ? `<source url="https://x">${source}</source>` : ''}</item>`;

test('parseRss: 제목·링크·출처·날짜를 뽑고 제목 끝의 출처를 떼어낸다', () => {
  const [a] = parseRss(rss([item({ title: '금리 동결 - 한국경제', source: '한국경제' })]));
  assert.equal(a.title, '금리 동결');
  assert.equal(a.source, '한국경제');
  assert.equal(a.link, 'https://example.com/a');
  assert.equal(a.pubDate, '2026-11-14T02:00:00.000Z');
});

test('parseRss: CDATA 와 HTML 엔티티를 풀어 준다', () => {
  const [a] = parseRss(rss([item({ title: '<![CDATA[A &amp; B &quot;C&quot;]]>' })]));
  assert.equal(a.title, 'A & B "C"');
});

test('parseRss: http(s) 가 아닌 링크와 빈 제목은 버린다', () => {
  const out = parseRss(rss([
    item({ title: '나쁜 링크', link: 'javascript:alert(1)' }),
    item({ title: '', link: 'https://example.com/b' }),
    item({ title: '정상', link: 'https://example.com/c' }),
  ]));
  assert.deepEqual(out.map((o) => o.title), ['정상']);
});

test('parseRss: limit 을 지키고, 날짜가 이상하면 빈 문자열', () => {
  const many = Array.from({ length: 9 }, (_, i) => item({ title: `t${i}`, pubDate: 'nonsense' }));
  const out = parseRss(rss(many), 3);
  assert.equal(out.length, 3);
  assert.equal(out[0].pubDate, '');
});

test('parseRss: 비정상 입력에도 던지지 않는다', () => {
  assert.deepEqual(parseRss(''), []);
  assert.deepEqual(parseRss(null), []);
  assert.deepEqual(parseRss('<html>no rss</html>'), []);
});

function fakeRes() {
  const res = { headers: {}, code: 200, body: undefined };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.code = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

async function withFetch(impl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = real; }
}

const ok = (xml) => ({ ok: true, status: 200, text: async () => xml });

test('handler: 모든 분야를 모아 200 과 캐시 헤더를 준다', async () => {
  const res = fakeRes();
  await withFetch(async () => ok(rss([item({ title: '뉴스' })])), () => handler({ method: 'GET' }, res));
  assert.equal(res.code, 200);
  assert.deepEqual(Object.keys(res.body.items).sort(), Object.keys(FEEDS).sort());
  assert.equal(res.body.items.economy[0].title, '뉴스');
  assert.match(res.headers['cache-control'], /s-maxage=1800/);
});

test('handler: 한 분야가 실패해도 나머지는 돌려준다', async () => {
  const res = fakeRes();
  await withFetch(async (url) => {
    if (String(url).includes('BUSINESS')) throw new Error('boom');
    return ok(rss([item({ title: '뉴스' })]));
  }, () => handler({ method: 'GET' }, res));
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.items.economy, []);
  assert.equal(res.body.items.society.length, 1);
});

test('handler: 전부 실패하면 502 이고 캐시하지 않는다', async () => {
  const res = fakeRes();
  await withFetch(async () => ({ ok: false, status: 500, text: async () => '' }), () => handler({ method: 'GET' }, res));
  assert.equal(res.code, 502);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('handler: GET 이외는 405', async () => {
  const res = fakeRes();
  await handler({ method: 'POST' }, res);
  assert.equal(res.code, 405);
  assert.equal(res.headers.allow, 'GET');
});
