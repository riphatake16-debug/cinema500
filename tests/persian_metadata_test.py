import copy
import json
import unittest
import urllib.parse
from scripts.persian_metadata import PersianMetadata, empty_cache, translation_chunks, DAILY_CHARACTERS

STAMP = "2026-10-29T07:00:00+00:00"
TEXT = "یک جوان در تلاش برای ساختن آینده‌ای بهتر، با مشکلات و انتخاب‌های دشوار روبه‌رو می‌شود."


def title(ident="tt9999999"):
    return {"id": ident, "title": "New Film", "fa": "", "summary": "", "summaryLanguage": "fa"}


class PersianMetadataTests(unittest.TestCase):
    def provider(self, wiki=True, failure=False, quota=False):
        calls = []
        def request(url, data=None):
            calls.append((url, data))
            if failure:
                raise TimeoutError("offline")
            if "query.wikidata.org" in url:
                return {"results": {"bindings": [{"imdb": {"value": "tt9999999"}, "item": {"value": "http://www.wikidata.org/entity/Q123"},
                    "label": {"value": "فیلم تازه"}, "article": {"value": "https://fa.wikipedia.org/wiki/فیلم_تازه"}}] if wiki else []}}
            if "fa.wikipedia.org" in url:
                return {"query": {"pages": [{"ns": 0, "title": "فیلم تازه", "lastrevid": 123, "extract": TEXT}]}}
            if "caching.graphql.imdb.com" in url:
                ident = json.loads(data)["variables"]["id"]
                return {"data": {"title": {"id": ident, "plot": {"plotText": {"plainText": "A young man faces difficult choices while building a better future."}}}}}
            if "api.mymemory.translated.net" in url:
                return {"responseStatus": 429 if quota else 200, "quotaFinished": quota, "responseData": {"translatedText": TEXT}}
            raise AssertionError("unexpected provider")
        return request, calls

    def test_missing_title_uses_exact_id_persian_wiki_and_revision_attribution(self):
        request, calls = self.provider();row = title();metadata = PersianMetadata(empty_cache(), request, STAMP)
        self.assertEqual(metadata.enrich([row]), 1)
        self.assertEqual(row["fa"], "فیلم تازه");self.assertEqual(row["summary"], TEXT)
        self.assertIn("oldid=123", row["localization"]["summaryUrl"])
        self.assertEqual(row["localization"]["summarySource"], "wikipedia-fa")
        self.assertFalse(any("mymemory" in url for url, _ in calls))
        self.assertEqual(metadata.cache["translationUsage"], {})

    def test_missing_wiki_translates_real_id_matched_plot_and_name_once(self):
        request, calls = self.provider(wiki=False);row = title();metadata = PersianMetadata(empty_cache(), request, STAMP)
        self.assertEqual(metadata.enrich([row]), 1)
        self.assertEqual(row["localization"]["summarySource"], "mymemory")
        self.assertEqual(row["localization"]["faSource"], "mymemory")
        self.assertTrue(metadata.cache["translationUsage"]["characters"] > 0)
        cached = PersianMetadata(metadata.cache, lambda *a: self.fail("cache should avoid all requests"), STAMP)
        restored = title();cached.enrich([restored])
        self.assertEqual(restored["summary"], TEXT)
        self.assertEqual(restored["localization"], row["localization"])
        self.assertEqual(cached.cache, metadata.cache)

    def test_complete_curated_content_is_never_changed_or_sent_to_a_provider(self):
        row = {**title(), "fa": "نام انتخابی", "summary": "خلاصهٔ ویرایش‌شدهٔ خود سایت"};original = copy.deepcopy(row)
        metadata = PersianMetadata(empty_cache(), lambda *a: self.fail("curated text must stay local"), STAMP)
        self.assertEqual(metadata.enrich([row]), 0);self.assertEqual(row, original)

    def test_new_titles_without_a_summary_take_priority_over_old_name_only_gaps(self):
        request, calls = self.provider();rows = [{**title("tt000000" + str(i)), "summary": TEXT} for i in range(1, 5)] + [title()]
        metadata = PersianMetadata(empty_cache(), request, STAMP);metadata.enrich(rows)
        self.assertEqual(rows[-1]["fa"], "فیلم تازه");self.assertEqual(rows[-1]["summary"], TEXT)
        self.assertEqual(rows[3]["fa"], "")

    def test_provider_failure_keeps_good_fields_and_queues_a_retry(self):
        request, calls = self.provider(failure=True);row = {**title(), "fa": "نام فارسی فعلی"}
        metadata = PersianMetadata(empty_cache(), request, STAMP)
        metadata.enrich([row]);self.assertEqual(row["fa"], "نام فارسی فعلی");self.assertEqual(row["summary"], "")
        self.assertGreater(metadata.cache["retryAfter"][row["id"]], STAMP)
        before = len(calls);metadata.enrich([row]);self.assertEqual(len(calls), before)

    def test_quota_responses_are_not_published_and_stop_translation_requests(self):
        request, calls = self.provider(wiki=False, quota=True);row = title();metadata = PersianMetadata(empty_cache(), request, STAMP)
        metadata.enrich([row]);self.assertEqual(row["summary"], "");self.assertEqual(row["fa"], "")
        self.assertEqual(metadata.cache["translationUsage"]["characters"], DAILY_CHARACTERS)
        self.assertEqual(sum("api.mymemory" in url for url, _ in calls), 1)

    def test_chunk_limits_are_utf8_bytes_and_daily_usage_carries_between_runs(self):
        chunks = translation_chunks(("Résumé is a film about choices and friendship. " * 20).strip())
        self.assertGreater(len(chunks), 1);self.assertTrue(all(len(c.encode()) <= 480 for c in chunks))
        request, calls = self.provider(wiki=False);cache = empty_cache();cache["translationUsage"] = {"date": STAMP[:10], "characters": DAILY_CHARACTERS}
        metadata = PersianMetadata(cache, request, STAMP);metadata.enrich([title()])
        self.assertFalse(any("api.mymemory" in url for url, _ in calls))
        next_day = PersianMetadata(cache, request, "2026-10-30T07:00:00+00:00");self.assertEqual(next_day.translate("A new film."), TEXT)

    def test_ambiguous_imdb_mappings_and_unsafe_articles_are_not_followed(self):
        def request(url, data=None):
            return {"results": {"bindings": [{"imdb": {"value": "tt9999999"}, "item": {"value": "http://www.wikidata.org/entity/Q" + str(i)}} for i in (1, 2)]}}
        metadata = PersianMetadata(empty_cache(), request, STAMP)
        self.assertEqual(metadata.wikidata(["tt9999999"]), {})
        self.assertIsNone(metadata.wikipedia("https://evil.example/wiki/test"))

    def test_wrong_plot_id_and_non_persian_service_output_are_rejected(self):
        request = lambda *a: {"data": {"title": {"id": "tt1111111", "plot": {"plotText": {"plainText": "wrong movie"}}}}}
        metadata = PersianMetadata(empty_cache(), request, STAMP)
        with self.assertRaises(ValueError): metadata.plot("tt9999999")
        metadata.request = lambda *a: {"responseStatus": 200, "responseData": {"translatedText": "YOU USED ALL AVAILABLE FREE TRANSLATIONS"}}
        with self.assertRaises(ValueError): metadata.translate("A new film.")


if __name__ == "__main__":
    unittest.main()
