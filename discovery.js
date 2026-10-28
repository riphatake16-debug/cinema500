/* Small, local discovery engine. No network requests or personal data leave the browser. */
(() => {
  'use strict';
  const genres = ['Action','Adventure','Animation','Biography','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Music','Mystery','Romance','Sci-Fi','Sport','Thriller','War','Western'];
  const journeys = [
    {id:'mind', title:'ذهن را به بازی بگیر', subtitle:'پنج داستانِ چندلایه، از رؤیا تا واقعیت.', tag:'معما و خیال', color:'#9f8cdb', ids:['tt0133093','tt0209144','tt0482571','tt1375666','tt1130884']},
    {id:'animation', title:'انیمیشن، فراتر از کودکی', subtitle:'پنج جهانِ متفاوت دربارهٔ زندگی و خاطره.', tag:'رنگ، احساس، زندگی', color:'#d89c74', ids:['tt0245429','tt0910970','tt2380307','tt0095327','tt4633694']},
    {id:'classics', title:'پنج قرار با کلاسیک‌ها', subtitle:'از یک اتاقِ دادگاه تا خیابان‌های کازابلانکا.', tag:'قصه‌هایی ماندگار', color:'#8ab5aa', ids:['tt0050083','tt0034583','tt0027977','tt0047396','tt0043014']}
  ];
  function hash(value) {
    let n = 2166136261;
    for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function settings(raw, strict = false) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      if (strict) throw Error('invalid_discovery');
      raw = {};
    }
    const chosen = raw.genres ?? [];
    const active = raw.activeJourney ?? null;
    if (strict && (!Array.isArray(chosen) || chosen.length > 5 || chosen.some(g => !genres.includes(g)) || new Set(chosen).size !== chosen.length || (active !== null && !journeys.some(j => j.id === active)))) throw Error('invalid_discovery');
    return {
      genres: [...new Set(Array.isArray(chosen) ? chosen.filter(g => genres.includes(g)) : [])].slice(0, 5),
      activeJourney: journeys.some(j => j.id === active) ? active : null
    };
  }
  function mergeSettings(current, incoming) {
    const a = settings(current), b = settings(incoming, true);
    return {genres:a.genres.length ? a.genres : b.genres, activeJourney:a.activeJourney || b.activeJourney};
  }
  function taste(titles, preferences, selected = []) {
    const weights = new Map(selected.map(g => [g, 4]));
    const byId = new Map(titles.map(t => [t.id, t]));
    const values = typeof preferences?.values === 'function' ? preferences.values() : (preferences || []);
    for (const p of values) {
      const title = byId.get(p.id);
      if (!title) continue;
      const weight = (p.favorite ? 4 : 0) + (p.rating >= 7 ? (p.rating - 6) * 1.5 : p.rating && p.rating <= 4 ? -(5 - p.rating) * 1.5 : 0);
      for (const g of title.genres || []) weights.set(g, (weights.get(g) || 0) + weight / Math.sqrt(title.genres.length));
    }
    return weights;
  }
  function recommendations(titles, {seen = [], wanted = [], preferences = [], selectedGenres = [], kind = 'movie', mode = 'personal', day = '', round = 0, limit = 4} = {}) {
    const watched = new Set(seen), saved = new Set(wanted);
    const prefs = typeof preferences?.get === 'function' ? preferences : new Map(Array.from(preferences, p => [p.id,p]));
    const weights = taste(titles, prefs, selectedGenres);
    const maxWeight = Math.max(4, ...weights.values());
    const candidates = titles.filter(t => t.type === kind && !watched.has(t.id) && !(prefs.get(t.id)?.rating && prefs.get(t.id).rating <= 4) && (mode !== 'short' || (t.runtime > 0 && t.runtime <= (kind === 'tv' ? 35 : 100))));
    const ranked = candidates.map(t => {
      const matches = (t.genres || []).filter(g => (weights.get(g) || 0) > 0).sort((a,b) => weights.get(b) - weights.get(a));
      const affinity = (t.genres || []).reduce((n,g) => n + (weights.get(g) || 0) / maxWeight, 0) / Math.sqrt(Math.max(1,t.genres?.length));
      const variation = hash(t.id+'|'+day+'|'+round);
      const score = mode === 'explore' ? variation * 7 + (t.rating - 7) : affinity * 5 + (t.rating - 7) * 1.7 + variation * 2.5 + (saved.has(t.id) ? .7 : 0);
      const reason = mode === 'short' ? {type:'short'} : mode === 'explore' ? {type:'explore'} : matches.length ? {type:'genre',genre:matches[0]} : saved.has(t.id) ? {type:'watchlist'} : {type:'quality'};
      return {title:t, score, reason};
    });
    const picked = [];
    while (picked.length < limit && ranked.length) {
      ranked.sort((a,b) => {
        const diversity = item => picked.reduce((n,p) => n + (item.title.genres?.[0] === p.title.genres?.[0] ? .65 : 0) + (item.title.title.split(':')[0] === p.title.title.split(':')[0] ? 2 : 0),0);
        return (b.score - diversity(b)) - (a.score - diversity(a)) || a.title.rank - b.title.rank;
      });
      picked.push(ranked.shift());
    }
    return picked;
  }
  function similar(titles, source, seen = [], limit = 4) {
    const watched = new Set(seen), sourceGenres = new Set(source.genres || []);
    return titles.filter(t => t.id !== source.id && t.type === source.type).map(t => {
      const common = (t.genres || []).filter(g => sourceGenres.has(g)).length;
      const union = new Set([...(t.genres || []), ...sourceGenres]).size;
      return {title:t, score:common / Math.max(1,union) * 8 + (t.rating - 7) * .4 - Math.min(60,Math.abs(t.year-source.year)) / 100 - (watched.has(t.id) ? 2 : 0)};
    }).sort((a,b) => b.score - a.score || a.title.rank - b.title.rank).slice(0,limit).map(x => x.title);
  }
  function journeyProgress(journey, titles, seen = []) {
    const watched = new Set(seen), byId = new Map(titles.map(t => [t.id,t]));
    const entries = journey.ids.map(id => byId.get(id)).filter(Boolean);
    const done = entries.filter(t => watched.has(t.id)).length;
    return {entries, done, total:entries.length, next:entries.find(t => !watched.has(t.id)) || null};
  }
  window.CinemaDiscovery = {genres, journeys, settings, mergeSettings, taste, recommendations, similar, journeyProgress};
})();
