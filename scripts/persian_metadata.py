"""Fill missing Persian metadata once, outside visitors' browsers.

Wikidata resolves IMDb IDs, Persian Wikipedia supplies an attributed introduction,
and MyMemory's documented anonymous API translates a short IMDb plot if needed.
Failures are queued; curated text and successful translations are never replaced.
"""
import copy
import datetime as dt
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

USER_AGENT = "Cinema500/1.0 (https://github.com/riphatake16-debug/cinema500; Persian catalogue enrichment)"
IMDB_ENDPOINT = "https://caching.graphql.imdb.com/"
DAILY_CHARACTERS = 4500  # Below the documented 5,000-character anonymous limit.
MAX_TITLES = 4
ID_PATTERN = re.compile(r"tt\d{7,12}\Z")


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def persian(text, minimum=2):
    if not isinstance(text, str):
        return False
    letters = [c for c in text if c.isalpha()]
    count = sum("\u0620" <= c <= "\u06ff" for c in letters)
    return count >= minimum and count >= len(letters) * .55


def clean(text, maximum=1200):
    if not isinstance(text, str):
        return ""
    text = html.unescape(text).translate(str.maketrans({"ي": "ی", "ك": "ک", "\u200e": "", "\u200f": ""}))
    text = re.sub(r"\[\s*[\d۰-۹]+\s*\]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if re.search(r"<[^>]+>", text):
        return ""
    if len(text) > maximum:
        text = text[:maximum].rsplit(" ", 1)[0].rstrip(".،؛ ") + "…"
    return text


def empty_cache():
    return {"schemaVersion": 1, "titles": {}, "retryAfter": {}, "translationUsage": {}}


def read_cache(path):
    try:
        text = Path(path).read_text()
        if len(text) > 4_000_000:
            raise ValueError("oversized_cache")
        raw = json.loads(text)
        if raw.get("schemaVersion") != 1 or not all(isinstance(raw.get(k), dict) for k in ("titles", "retryAfter", "translationUsage")):
            raise ValueError("invalid_cache")
        return raw
    except (OSError, ValueError, TypeError, AttributeError):
        return empty_cache()


def translation_chunks(text):
    """Respect the provider's 500-byte UTF-8 limit without splitting a word."""
    text = clean(text, 900)
    chunks, current = [], ""
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        for word in sentence.split():
            candidate = (current + " " + word).strip()
            if len(candidate.encode()) > 480:
                if not current or len(word.encode()) > 480:
                    raise ValueError("untranslatable_segment")
                chunks.append(current);current = word
            else:
                current = candidate
        if current:
            chunks.append(current);current = ""
    if not chunks:
        raise ValueError("empty_translation")
    return chunks


class PersianMetadata:
    def __init__(self, cache, request=None, stamp=None, seconds=90):
        self.cache = copy.deepcopy(cache)
        self.request = request or self.fetch
        self.stamp = stamp or now_iso()
        self.day = self.stamp[:10]
        self.deadline = time.monotonic() + seconds
        self.translator_available = True

    def fetch(self, url, data=None):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("metadata_time_budget")
        headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
        if data is not None:
            headers.update({"Content-Type": "application/json", "x-imdb-client-name": "cinema500"})
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=min(15, remaining)) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError("oversized_metadata")
        return json.loads(raw)

    def wikidata(self, ids):
        values = " ".join(json.dumps(ident) for ident in ids if ID_PATTERN.fullmatch(ident))
        query = """SELECT ?imdb ?item ?label ?article WHERE {
          VALUES ?imdb { %s } ?item wdt:P345 ?imdb.
          OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "fa") }
          OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://fa.wikipedia.org/>. }
        }""" % values
        raw = self.request("https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": query, "format": "json"}))
        grouped = {}
        for row in raw.get("results", {}).get("bindings", []):
            ident = row.get("imdb", {}).get("value", "")
            if ident in ids:
                grouped.setdefault(ident, []).append(row)
        # Ambiguous identifiers are not matched by guessing from a title name.
        return {ident: rows[0] for ident, rows in grouped.items() if len({r.get("item", {}).get("value") for r in rows}) == 1}

    def wikipedia(self, article):
        url = urllib.parse.urlsplit(article)
        if url.scheme != "https" or url.netloc != "fa.wikipedia.org" or not url.path.startswith("/wiki/"):
            return None
        title = urllib.parse.unquote(url.path[len("/wiki/"):]).replace("_", " ")
        params = {"action": "query", "format": "json", "formatversion": "2", "prop": "extracts|info", "inprop": "url",
                  "exintro": "1", "explaintext": "1", "exchars": "1000", "redirects": "1", "titles": title}
        raw = self.request("https://fa.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params))
        pages = raw.get("query", {}).get("pages", [])
        if len(pages) != 1 or pages[0].get("missing") or pages[0].get("ns") != 0:
            return None
        page = pages[0]
        # Keep the first paragraph as an introduction, without inventing a plot.
        text = clean((page.get("extract") or "").split("\n", 1)[0], 1000)
        if not persian(text, 25):
            return None
        source = article
        if isinstance(page.get("lastrevid"), int):
            source = "https://fa.wikipedia.org/w/index.php?" + urllib.parse.urlencode({"title": page["title"], "oldid": page["lastrevid"]})
        return text, source

    def plot(self, ident):
        query = 'query Cinema500Plot($id: ID!) { title(id: $id) { id plot { plotText { plainText } } } }'
        raw = self.request(IMDB_ENDPOINT, json.dumps({"query": query, "variables": {"id": ident}, "operationName": "Cinema500Plot"}).encode())
        node = (raw.get("data") or {}).get("title") or {}
        if raw.get("errors") or node.get("id") != ident:
            raise ValueError("plot_id_mismatch")
        return clean(((node.get("plot") or {}).get("plotText") or {}).get("plainText"), 900)

    def translate(self, text):
        if not self.translator_available:
            raise ValueError("translator_unavailable")
        chunks = translation_chunks(text)
        usage = self.cache["translationUsage"]
        if usage.get("date") != self.day:
            usage = {"date": self.day, "characters": 0}
            self.cache["translationUsage"] = usage
        if not isinstance(usage.get("characters"), int) or usage["characters"] < 0:
            usage["characters"] = DAILY_CHARACTERS
        if usage["characters"] + sum(map(len, chunks)) > DAILY_CHARACTERS:
            raise ValueError("translation_daily_budget")
        translated = []
        for chunk in chunks:
            # Count attempted requests too; failures may still consume quota.
            usage["characters"] += len(chunk)
            params = {"q": chunk, "langpair": "en|fa", "mt": "1"}
            try:
                raw = self.request("https://api.mymemory.translated.net/get?" + urllib.parse.urlencode(params))
                if raw.get("quotaFinished") or str(raw.get("responseStatus")) == "429":
                    usage["characters"] = DAILY_CHARACTERS
                    raise ValueError("translation_quota")
                result = clean((raw.get("responseData") or {}).get("translatedText"), 2000)
                if str(raw.get("responseStatus")) != "200" or not persian(result):
                    raise ValueError("invalid_translation")
                translated.append(result)
            except Exception:
                self.translator_available = False
                raise
        return " ".join(translated)

    def enrich(self, titles):
        changed, pending = 0, []
        for row in titles:
            cached = self.cache["titles"].get(row["id"], {})
            provenance = dict(row.get("localization") or {})
            for field in ("fa", "summary"):
                if not row.get(field) and persian(cached.get(field), 2 if field == "fa" else 25):
                    row[field] = cached[field]
                    for key in (field + "Source", field + "Url"):
                        if cached.get("localization", {}).get(key):
                            provenance[key] = cached["localization"][key]
            if provenance:
                row["localization"] = provenance
            if not row.get("fa") or not row.get("summary"):
                if self.cache["retryAfter"].get(row["id"], "") <= self.stamp:
                    pending.append(row)
        # A newly entered title without a synopsis goes ahead of older name-only gaps.
        pending.sort(key=lambda row: (bool(row.get("summary")), row.get("rank") or 251))
        pending = pending[:MAX_TITLES]
        if not pending:
            return changed
        try:
            matched = self.wikidata([row["id"] for row in pending])
        except Exception:
            matched = {}
        for row in pending:
            if time.monotonic() >= self.deadline:
                break
            ident = row["id"]
            before = (row.get("fa", ""), row.get("summary", ""))
            provenance = dict(row.get("localization") or {})
            match = matched.get(ident, {})
            label = clean(match.get("label", {}).get("value", ""), 500)
            entity = match.get("item", {}).get("value", "").replace("http://www.wikidata.org/", "https://www.wikidata.org/")
            if not row.get("fa") and persian(label) and re.fullmatch(r"https://www\.wikidata\.org/entity/Q\d+", entity):
                row["fa"] = label
                provenance.update(faSource="wikidata", faUrl=entity)
            if not row.get("summary") and match.get("article"):
                try:
                    intro = self.wikipedia(match["article"]["value"])
                    if intro:
                        row["summary"], source = intro
                        provenance.update(summarySource="wikipedia-fa", summaryUrl=source)
                except Exception:
                    pass
            if not row.get("summary"):
                try:
                    plot = self.plot(ident)
                    if plot:
                        row["summary"] = self.translate(plot)
                        provenance.update(summarySource="mymemory", summaryUrl="https://www.imdb.com/title/" + ident + "/")
                except Exception:
                    pass
            if not row.get("fa"):
                try:
                    row["fa"] = self.translate(row["title"])
                    provenance.update(faSource="mymemory", faUrl="https://www.imdb.com/title/" + ident + "/")
                except Exception:
                    pass
            if provenance:
                row["localization"] = provenance
            if (row.get("fa", ""), row.get("summary", "")) != before:
                changed += 1
                self.cache["titles"][ident] = {k: row[k] for k in ("fa", "summary", "summaryLanguage", "localization") if k in row}
            if row.get("fa") and row.get("summary"):
                self.cache["retryAfter"].pop(ident, None)
            else:
                retry = dt.datetime.fromisoformat(self.stamp.replace("Z", "+00:00")) + dt.timedelta(hours=6)
                self.cache["retryAfter"][ident] = retry.isoformat(timespec="seconds")
        return changed
