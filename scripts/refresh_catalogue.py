"""Publish validated IMDb charts; retain the last good catalogue on upstream failure.

No third-party package, account credential, browser fingerprint or proxy is used.
The cached public chart response is checked hourly by the Pages workflow.
"""
import argparse
import copy
import datetime as dt
import hashlib
import json
import re
import urllib.request
from pathlib import Path

if __package__:
    from .persian_metadata import PersianMetadata, read_cache
else:
    from persian_metadata import PersianMetadata, read_cache

ENDPOINT = "https://caching.graphql.imdb.com/"
DEPLOYED_FEED = "https://riphatake16-debug.github.io/cinema500/live-catalogue.json"
QUERY = """query Cinema500Charts {
  movies: chartTitles(first: 250, chart: {chartType: TOP_RATED_MOVIES}) {
    edges { currentRank node { id titleText { text } releaseYear { year }
      ratingsSummary { aggregateRating } primaryImage { url }
      genres { genres { text } } runtime { seconds }
    } }
  }
  series: chartTitles(first: 250, chart: {chartType: TOP_RATED_TV_SHOWS}) {
    edges { currentRank node { id titleText { text } releaseYear { year }
      ratingsSummary { aggregateRating } primaryImage { url }
      genres { genres { text } } runtime { seconds }
    } }
  }
}"""
HEADERS = {"Content-Type": "application/json", "Accept": "application/json",
           "x-imdb-client-name": "cinema500", "User-Agent": "Cinema500/1.0 (hourly public chart check)"}

def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

def read_seed(path):
    return json.loads(Path(path).read_text().split("=", 1)[1].rstrip(";\n"))

def fetch_json(url, data=None):
    req = urllib.request.Request(url, data=data, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=35) as response:
        raw = response.read(8_000_001)
    if len(raw) > 8_000_000:
        raise ValueError("oversized_response")
    return json.loads(raw)

def valid_title(row, ranked=True):
    if not isinstance(row, dict) or not re.fullmatch(r"tt\d{7,12}", row.get("id", "")):
        raise ValueError("invalid_id")
    if row.get("type") not in ("movie", "tv") or not isinstance(row.get("title"), str) or not 1 <= len(row["title"]) <= 500:
        raise ValueError("invalid_title")
    if not isinstance(row.get("year"), int) or not 1800 <= row["year"] <= 2100:
        raise ValueError("invalid_year")
    if not isinstance(row.get("rating"), (int, float)) or not 0 < row["rating"] <= 10:
        raise ValueError("invalid_rating")
    if ranked and (not isinstance(row.get("rank"), int) or not 1 <= row["rank"] <= 250):
        raise ValueError("invalid_rank")
    if not isinstance(row.get("genres"), list) or any(not isinstance(g, str) or len(g) > 60 for g in row["genres"]):
        raise ValueError("invalid_genres")
    poster = row.get("poster", "")
    if poster and not (re.fullmatch(r"\./posters/tt\d{7,12}\.jpg", poster) or poster.startswith("https://m.media-amazon.com/images/")):
        raise ValueError("invalid_poster")
    return row

def validate(feed):
    titles = feed.get("titles", [])
    if len(titles) != 500 or len({t.get("id") for t in titles}) != 500:
        raise ValueError("incomplete_catalogue")
    for row in titles:
        valid_title(row)
    for kind in ("movie", "tv"):
        ranks = sorted(t["rank"] for t in titles if t["type"] == kind)
        if ranks != list(range(1, 251)):
            raise ValueError("incomplete_chart")
    stamp = dt.datetime.fromisoformat(feed["retrievedAt"].replace("Z", "+00:00"))
    if stamp.tzinfo is None or stamp > dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=10):
        raise ValueError("invalid_timestamp")
    archive = feed.get("archive", [])
    if not isinstance(archive, list) or len(archive) > 10000:
        raise ValueError("invalid_archive")
    active = {t["id"] for t in titles}
    if len({t.get("id") for t in archive}) != len(archive):
        raise ValueError("duplicate_archive")
    for row in archive:
        valid_title(row, False)
        if row["id"] in active:
            raise ValueError("active_archive_overlap")
    return feed

def from_response(response, seed, previous=None, stamp=None, localizations=None):
    if response.get("errors"):
        raise ValueError("graphql_errors")
    stamp = stamp or now_iso()
    memory = {t["id"]: t for t in (previous or {}).get("archive", []) + (previous or {}).get("titles", [])}
    # Curated Persian names and summaries take precedence over cached copies.
    for curated in seed["titles"]:
        memory[curated["id"]] = {**memory.get(curated["id"], {}), **curated}
        memory[curated["id"]].pop("localization", None)
    titles = []
    for key, kind in (("movies", "movie"), ("series", "tv")):
        edges = response.get("data", {}).get(key, {}).get("edges", [])
        if len(edges) != 250:
            raise ValueError("incomplete_response")
        for edge in edges:
            node = edge.get("node", {}); ident = node.get("id"); prior = {**memory.get(ident, {}), **(localizations or {}).get(ident, {})}
            runtime = (node.get("runtime") or {}).get("seconds")
            row = {"id": ident, "type": kind, "rank": edge.get("currentRank"),
                   "title": node.get("titleText", {}).get("text"),
                   "year": (node.get("releaseYear") or {}).get("year"),
                   "rating": (node.get("ratingsSummary") or {}).get("aggregateRating"),
                   "poster": prior.get("poster") or (node.get("primaryImage") or {}).get("url") or "",
                   "genres": [g["text"] for g in (node.get("genres") or {}).get("genres", [])],
                   "runtime": round(runtime / 60) if isinstance(runtime, (int, float)) and runtime > 0 else prior.get("runtime", 0),
                   "fa": prior.get("fa", ""), "summary": prior.get("summary", ""), "summaryLanguage": "fa"}
            if prior.get("aliases"):
                row["aliases"] = prior["aliases"]
            if prior.get("localization"):
                provenance = dict(prior["localization"])
                for field in ("fa", "summary"):
                    if (localizations or {}).get(ident, {}).get(field):
                        provenance.pop(field + "Source", None);provenance.pop(field + "Url", None)
                if provenance:
                    row["localization"] = provenance
            valid_title(row);titles.append(row)
    active = {t["id"] for t in titles}
    archive = [{**row, "rank": None} for ident, row in memory.items() if ident not in active]
    payload = {"titles": titles, "archive": archive}
    version = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return validate({"schemaVersion": 1, "version": version, "status": "ok", "retrievedAt": stamp,
                     "checkedAt": stamp, "refreshMinutes": 60,
                     "source": {"provider": "imdb-public-chart-cache", "movie": "https://www.imdb.com/chart/top/",
                                "tv": "https://www.imdb.com/chart/toptv/"}, **payload})

def curated_text(feed, seed, localizations=None):
    """Keep reviewed copy when an outage makes an older chart cache necessary."""
    result = copy.deepcopy(feed)
    curated = {t["id"]: t for t in seed["titles"]}
    for ident, fields in (localizations or {}).items():
        curated[ident] = {**curated.get(ident, {}), **fields}
    for row in result["titles"] + result.get("archive", []):
        fields = curated.get(row["id"], {})
        provenance = dict(row.get("localization") or {})
        for field in ("fa", "summary"):
            if fields.get(field):
                row[field] = fields[field]
                provenance.pop(field + "Source", None)
                provenance.pop(field + "Url", None)
        if fields.get("summary"):
            row["summaryLanguage"] = "fa"
        if fields.get("aliases"):
            row["aliases"] = list(dict.fromkeys(row.get("aliases", []) + fields["aliases"]))
        if provenance:
            row["localization"] = provenance
        else:
            row.pop("localization", None)
    payload = {"titles": result["titles"], "archive": result.get("archive", [])}
    result["version"] = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return validate(result)

def fallback(seed, candidates, stamp=None, localizations=None):
    valid = [seed]
    for candidate in candidates:
        try:
            valid.append(validate(candidate))
        except (ValueError, TypeError, KeyError, AttributeError):
            pass
    chosen = max(valid, key=lambda x: x["retrievedAt"])
    return curated_text({**chosen, "schemaVersion": 1, "status": "stale", "checkedAt": stamp or now_iso(),
                         "refreshMinutes": 60, "error": "source_unavailable"}, seed, localizations)

def write_json(path, data):
    target = Path(path);target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(target.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    temp.replace(target)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", default="catalogue.js")
    parser.add_argument("--output", default="_site/live-catalogue.json")
    parser.add_argument("--bundle", default="_site/catalogue.js")
    parser.add_argument("--last-good", default="data/catalogue-last-good.json")
    parser.add_argument("--persian-cache", default="data/persian-metadata-cache.json")
    args = parser.parse_args();seed = read_seed(args.seed);validate(seed)
    previous = None
    try:
        previous = validate(json.loads(Path(args.last_good).read_text()))
    except (OSError, ValueError, TypeError, KeyError):
        pass
    locale_path = Path("content/catalogue-localizations-fa.json")
    localizations = json.loads(locale_path.read_text()) if locale_path.exists() else {}
    try:
        result = from_response(fetch_json(ENDPOINT, json.dumps({"query": QUERY, "operationName": "Cinema500Charts"}).encode()), seed, previous, localizations=localizations)
        print("IMDb chart refresh succeeded: 250 movies, 250 series; fetched", result["retrievedAt"])
    except Exception as error:
        print("::warning::IMDb refresh unavailable:", type(error).__name__)
        candidates = [previous] if previous else []
        try:
            candidates.append(fetch_json(DEPLOYED_FEED))
        except Exception:
            pass
        result = fallback(seed, candidates, localizations=localizations)
        print("Retained last valid catalogue from", result["retrievedAt"])
    # Metadata providers are independent: a failure never discards fresh ranks.
    try:
        cache = read_cache(args.persian_cache)
        metadata = PersianMetadata(cache)
        candidate = copy.deepcopy(result)
        completed = metadata.enrich(candidate["titles"])
        payload = {"titles": candidate["titles"], "archive": candidate.get("archive", [])}
        candidate["version"] = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        validate(candidate)
        if metadata.cache != cache:
            write_json(args.persian_cache, metadata.cache)
        result = candidate
        print("Persian metadata:", completed, "newly enriched;", sum(bool(t.get("fa")) and bool(t.get("summary")) for t in result["titles"]), "complete titles")
    except Exception as error:
        print("::warning::Persian metadata deferred:", type(error).__name__)
    write_json(args.output, result)
    Path(args.bundle).parent.mkdir(parents=True, exist_ok=True)
    Path(args.bundle).write_text("window.CINEMA_CATALOGUE = " + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n")
    # One checkpoint per day also records repository activity for scheduled runs.
    if result["status"] == "ok" and (not previous or previous["retrievedAt"][:10] != result["retrievedAt"][:10]):
        write_json(args.last_good, result)

if __name__ == "__main__":
    main()
