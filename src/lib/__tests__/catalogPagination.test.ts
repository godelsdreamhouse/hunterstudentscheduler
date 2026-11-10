import { describe, expect, it } from "vitest";
import type { CatalogSectionPage } from "../catalog";
import { appendUniqueCatalogSections, createCatalogPaginationGuard } from "../catalogPagination";
import { section } from "./fixtures";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("catalog pagination request coordination", () => {
  it("does not let an old load-more response contaminate a replaced dataset", async () => {
    const guard = createCatalogPaginationGuard();
    const initialSection = section({ class_num: 1001, course_id: "initial", course_code: "TEST 1" });
    const staleSection = section({ class_num: 1002, course_id: "stale", course_code: "TEST 2" });
    const filteredSection = section({ class_num: 2001, course_id: "filtered", course_code: "TEST 3" });
    let results = [initialSection];
    let hasMore = true;

    guard.beginDataset(); // hideFull=false page zero
    const oldLoadMoreGeneration = guard.currentDataset();
    const oldResponse = deferred<CatalogSectionPage>();
    const oldLoadMore = oldResponse.promise.then((page) => {
      if (!guard.accepts(oldLoadMoreGeneration)) return;
      results = appendUniqueCatalogSections(results, page.sections);
      hasMore = page.pagination.has_more;
    });

    const filteredGeneration = guard.beginDataset(); // hideFull=true page zero
    expect(guard.accepts(filteredGeneration)).toBe(true);
    results = [filteredSection];
    hasMore = false;

    oldResponse.resolve({
      sections: [staleSection],
      pagination: { limit: 50, offset: 1, has_more: true },
    });
    await oldLoadMore;

    expect(results).toEqual([filteredSection]);
    expect(hasMore).toBe(false);
    expect(results.length).toBe(1); // the next request's offset
  });
});
