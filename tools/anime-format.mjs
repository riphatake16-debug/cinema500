const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#039': "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…' };

export function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
      if (ENTITIES[code]) return ENTITIES[code];
      if (/^#x/i.test(code)) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (/^#/.test(code)) return String.fromCodePoint(parseInt(code.slice(1), 10));
      return match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function shorten(text, limit = 300) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (stop > limit * 0.5) return cut.slice(0, stop + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut) + '…';
}

export function slug(text, fallback = 'anime') {
  const value = String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
  return value || fallback;
}
