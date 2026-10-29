"""Check the public chart response from a runner without credentials or browser state."""
import json
import urllib.error
import urllib.request

QUERY = """query Cinema500Charts {
  movies: chartTitles(first: 250, chart: {chartType: TOP_RATED_MOVIES}) {
    edges { node { id titleText { text } releaseYear { year }
      ratingsSummary { aggregateRating topRanking { rank } }
      primaryImage { url } titleGenres { genres { genre { text } } }
    } }
  }
  series: chartTitles(first: 250, chart: {chartType: TOP_RATED_TV_SHOWS}) {
    edges { node { id titleText { text } releaseYear { year }
      ratingsSummary { aggregateRating topRanking { rank } }
      primaryImage { url } titleGenres { genres { genre { text } } }
    } }
  }
}"""

def main():
    request = urllib.request.Request(
        "https://api.graphql.imdb.com/",
        data=json.dumps({"query": QUERY, "operationName": "Cinema500Charts"}).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json",
                 "User-Agent": "Cinema500/1.0 (hourly public chart check)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        print(json.dumps({"status": error.code, "body": error.read(500).decode("utf-8", "replace")}))
        raise SystemExit(1)
    if result.get("errors"):
        print(json.dumps({"errors": result["errors"]}, ensure_ascii=False))
        raise SystemExit(1)
    for key in ("movies", "series"):
        entries = [edge["node"] for edge in result.get("data", {}).get(key, {}).get("edges", [])]
        assert len(entries) == 250, (key, len(entries))
        assert len({row["id"] for row in entries}) == 250
        print(json.dumps({"chart": key, "count": len(entries), "first": entries[:2], "last": entries[-1:]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
