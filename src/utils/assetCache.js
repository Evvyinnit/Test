const BOT_ASSETS_CACHE = 'nevy_bot_assets_v1';
const inflight = new Set();

function uniqUrls(urls) {
  return [...new Set((urls || []).filter(Boolean))];
}

function scheduleIdle(work) {
  if (typeof window === 'undefined') return;
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => work(), { timeout: 1500 });
  } else {
    setTimeout(() => work(), 250);
  }
}

export function warmBotAssets(urls, { max = 80 } = {}) {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  const targets = uniqUrls(urls).slice(0, max);
  if (targets.length === 0) return;

  scheduleIdle(async () => {
    let cache;
    try {
      cache = await caches.open(BOT_ASSETS_CACHE);
    } catch (err) {
      console.warn('Unable to open asset cache', err);
      return;
    }

    await Promise.all(
      targets.map(async (url) => {
        if (inflight.has(url)) return;
        inflight.add(url);
        try {
          const existing = await cache.match(url);
          if (!existing) {
            const request = new Request(url, { mode: 'no-cors', credentials: 'omit' });
            const response = await fetch(request);
            await cache.put(url, response);
          }
        } catch (err) {
          console.warn('Asset cache fetch failed', err);
        } finally {
          inflight.delete(url);
        }
      })
    );
  });
}
