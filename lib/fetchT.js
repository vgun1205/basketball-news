// 타임아웃 있는 fetch. 네트워크 정체 시 무한대기 방지(스케줄러 hang 예방).
export async function fetchT(url, opts = {}, ms = 12000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, {
      ...opts,
      signal: ac.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (basketball-news-bot)', ...(opts.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}
