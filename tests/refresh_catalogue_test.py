import copy
import datetime as dt
import unittest
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


if __name__ == "__main__":
    unittest.main()
