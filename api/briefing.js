// Vercel 서버리스 함수: 경제·사회·환경·기술 뉴스의 제목/링크만 모아 돌려준다.
// 본문은 가져오거나 저장하지 않는다. 자세한 내용은 원문 링크에서 확인한다.

const q = (s) => encodeURIComponent(s);
const TAIL = 'hl=ko&gl=KR&ceid=KR:ko';

export const FEEDS = {
  economy: `https://news.google.com/rss/headlines/section/topic/BUSINESS?${TAIL}`,
  society: `https://news.google.com/rss/headlines/section/topic/NATION?${TAIL}`,
  environment: `https://news.google.com/rss/search?q=${q('기후 OR 환경 OR 에너지')}&${TAIL}`,
  tech: `https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?${TAIL}`,
};

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m])
    .trim();
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
}

/** RSS XML → [{title, link, source, pubDate}] (최대 limit개) */
export function parseRss(xml, limit = 5) {
  const items = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const link = tag(body, 'link');
    if (!/^https?:\/\//.test(link)) continue; // 이상한 스킴(javascript: 등)은 버린다
    const source = tag(body, 'source');
    let title = tag(body, 'title');
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    if (!title) continue;
    const date = new Date(tag(body, 'pubDate'));
    items.push({
      title,
      link,
      source,
      pubDate: Number.isNaN(date.getTime()) ? '' : date.toISOString(),
    });
    if (items.length >= limit) break;
  }
  return items;
}

async function fetchFeed(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'strategic-diary/1.0 (+https://github.com/kimdambak/strategic-diary)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  return parseRss(await res.text());
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }

  const entries = await Promise.all(
    Object.entries(FEEDS).map(async ([key, url]) => {
      try {
        return [key, await fetchFeed(url)];
      } catch {
        return [key, []]; // 한 분야가 실패해도 나머지는 보여 준다
      }
    }),
  );
  const items = Object.fromEntries(entries);
  const total = Object.values(items).reduce((n, a) => n + a.length, 0);

  // 30분 캐시, 만료 후에도 1시간은 오래된 것을 먼저 보여 주고 뒤에서 갱신한다.
  res.setHeader('cache-control', total ? 's-maxage=1800, stale-while-revalidate=3600' : 'no-store');
  return res.status(total ? 200 : 502).json({ updatedAt: new Date().toISOString(), items });
}
