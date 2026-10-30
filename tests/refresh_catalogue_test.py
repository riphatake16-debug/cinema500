import copy
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import refresh_catalogue
from scripts.refresh_catalogue import read_seed, from_response, validate, fallback


class RefreshCatalogueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seed = read_seed("catalogue.js")

    def response(self):
        result = {"data": {"movies": {"edges": []}, "series": {"edges": []}}}
        for t in self.seed["titles"]:
            node = {"id": t["id"], "titleText": {"text": t["title"]}, "releaseYear": {"year": t["year"]},
                    "ratingsSummary": {"aggregateRating": t["rating"]}, "primaryImage": {"url": ""},
                    "genres": {"genres": [{"text": g} for g in t["genres"]]}, "runtime": {"seconds": (t.get("runtime") or 0) * 60}}
            result["data"]["movies" if t["type"] == "movie" else "series"]["edges"].append({"currentRank": t["rank"], "node": node})
        return result

    def test_rank_changes_preserve_persian_content_and_local_posters(self):
        source = self.response();rows = source["data"]["movies"]["edges"]
        rows[0]["currentRank"], rows[1]["currentRank"] = 2, 1
        feed = from_response(source, self.seed)
        title = next(t for t in feed["titles"] if t["id"] == "tt0111161")
        self.assertEqual(title["rank"], 2)
        self.assertEqual(title["fa"], self.seed["titles"][0]["fa"])
        self.assertEqual(title["summary"], self.seed["titles"][0]["summary"])
        self.assertEqual(title["poster"], self.seed["titles"][0]["poster"])

    def test_a_new_title_enters_and_the_departed_title_is_archived(self):
        source = self.response();old = source["data"]["movies"]["edges"][0]["node"]["id"]
        source["data"]["movies"]["edges"][0]["node"].update({"id": "tt9999999", "titleText": {"text": "Fixture"}, "primaryImage": {"url": "https://m.media-amazon.com/images/test.jpg"}})
        feed = from_response(source, self.seed)
        self.assertEqual(len(feed["titles"]), 500)
        self.assertTrue(any(t["id"] == "tt9999999" for t in feed["titles"]))
        archived = next(t for t in feed["archive"] if t["id"] == old)
        self.assertIsNone(archived["rank"])
        self.assertEqual(archived["summary"], self.seed["titles"][0]["summary"])

    def test_incomplete_duplicate_or_error_responses_never_replace_valid_data(self):
        for fault in ("partial", "duplicate", "errors", "duplicate_rank"):
            source = self.response()
            if fault == "partial": source["data"]["series"]["edges"].pop()
            if fault == "duplicate": source["data"]["movies"]["edges"][1]["node"]["id"] = source["data"]["movies"]["edges"][0]["node"]["id"]
            if fault == "errors": source["errors"] = [{"message": "unavailable"}]
            if fault == "duplicate_rank": source["data"]["movies"]["edges"][1]["currentRank"] = 1
            with self.subTest(fault=fault), self.assertRaises(ValueError):
                from_response(source, self.seed)

    def test_failure_retains_the_original_success_time_and_marks_stale(self):
        feed = from_response(self.response(), self.seed)
        retained = fallback(self.seed, [{"titles": []}, feed], stamp="2026-10-29T23:00:00+00:00")
        self.assertEqual(retained["retrievedAt"], feed["retrievedAt"])
        self.assertEqual(retained["version"], feed["version"])
        self.assertEqual(retained["status"], "stale")
        self.assertNotEqual(retained["checkedAt"], retained["retrievedAt"])

    def test_unsafe_images_and_future_timestamps_are_rejected(self):
        feed = from_response(self.response(), self.seed)
        unsafe = copy.deepcopy(feed);unsafe["titles"][0]["poster"] = "javascript:alert(1)"
        with self.assertRaises(ValueError): validate(unsafe)
        future = copy.deepcopy(feed);future["retrievedAt"] = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)).isoformat()
        with self.assertRaises(ValueError): validate(future)

    def test_outage_keeps_reviewed_copy_without_reverting_live_ranks_or_new_titles(self):
        source = self.response();rows = source["data"]["movies"]["edges"]
        retired = rows[0]["node"]["id"];active = rows[1]["node"]["id"]
        rows[0]["node"].update({"id": "tt9999999", "titleText": {"text": "New title"}})
        rows[0]["currentRank"], rows[1]["currentRank"] = 2, 1
        cached = from_response(source, self.seed)
        current = next(t for t in cached["titles"] if t["id"] == active)
        current.update({"summary": "نسخهٔ قدیمی", "localization": {"summarySource": "mymemory"}})
        archived = next(t for t in cached["archive"] if t["id"] == retired)
        archived["summary"] = "نسخهٔ قدیمی آرشیو"
        new = next(t for t in cached["titles"] if t["id"] == "tt9999999")
        new.update({"fa": "نام فارسی تازه", "summary": "متن خودکار", "localization": {"faSource": "wikidata", "summarySource": "mymemory"}})
        original = copy.deepcopy(cached)
        retained = fallback(self.seed, [cached], localizations={"tt9999999": {"summary": "متن بررسی‌شده"}})
        restored = next(t for t in retained["titles"] if t["id"] == active)
        self.assertEqual(restored["rank"], 1)
        self.assertEqual(restored["summary"], self.seed["titles"][1]["summary"])
        self.assertNotIn("localization", restored)
        self.assertEqual(next(t for t in retained["archive"] if t["id"] == retired)["summary"], self.seed["titles"][0]["summary"])
        fresh = next(t for t in retained["titles"] if t["id"] == "tt9999999")
        self.assertEqual(fresh["rank"], 2)
        self.assertEqual(fresh["fa"], "نام فارسی تازه")
        self.assertEqual(fresh["summary"], "متن بررسی‌شده")
        self.assertEqual(fresh["localization"], {"faSource": "wikidata"})
        self.assertEqual(retained["retrievedAt"], cached["retrievedAt"])
        self.assertEqual(retained["status"], "stale")
        self.assertNotEqual(retained["version"], cached["version"])
        self.assertEqual(cached, original)

    def test_curated_names_and_summaries_remove_obsolete_automatic_provenance(self):
        previous = from_response(self.response(), self.seed)
        previous["titles"][0]["localization"] = {"summarySource": "mymemory", "summaryUrl": "https://www.imdb.com/title/tt0111161/"}
        result = from_response(self.response(), self.seed, previous)
        self.assertNotIn("localization", result["titles"][0])
        self.assertEqual(result["titles"][0]["summary"], self.seed["titles"][0]["summary"])

    def test_metadata_failure_does_not_discard_fresh_ranks_or_partially_mutate_output(self):
        response = self.response();rows = response["data"]["movies"]["edges"]
        rows[0]["currentRank"], rows[1]["currentRank"] = 2, 1
        def fail_after_partial_edit(titles):
            titles[0]["summary"] = "must not be published"
            raise TimeoutError("metadata unavailable")
        with tempfile.TemporaryDirectory(dir=".") as temp:
            output = Path(temp) / "feed.json"
            arguments = ["refresh_catalogue.py", "--output", str(output), "--bundle", str(Path(temp) / "bundle.js"),
                         "--last-good", str(Path(temp) / "checkpoint.json"), "--persian-cache", str(Path(temp) / "cache.json")]
            with patch("sys.argv", arguments), patch.object(refresh_catalogue, "fetch_json", return_value=response), patch.object(refresh_catalogue.PersianMetadata, "enrich", side_effect=fail_after_partial_edit):
                refresh_catalogue.main()
            result = validate(json.loads(output.read_text()))
            self.assertEqual(result["status"], "ok");self.assertEqual(result["titles"][0]["rank"], 2)
            self.assertEqual(result["titles"][0]["summary"], self.seed["titles"][0]["summary"])


if __name__ == "__main__":
    unittest.main()
