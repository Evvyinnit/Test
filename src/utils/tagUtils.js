export function normalizeTag(raw) {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^#+/, '') // remove leading hashtags
    .replace(/\s+/g, ' ')
    .slice(0, 32);
}

export function slugifyTag(raw) {
  const t = normalizeTag(raw).toLowerCase();
  // allow a-z 0-9 and hyphen
  return t
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 32);
}

export function parseTagsFromText(text) {
  if (!text) return [];
  return text
    .split(',')
    .map(t => normalizeTag(t))
    .filter(Boolean);
}

export function uniqueTags(tags) {
  const seen = new Set();
  const out = [];
  for (const t of tags || []) {
    const n = normalizeTag(t);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}
