import { afterEach, describe, expect, it, vi } from "vitest";
import { searchCatalogSections } from "../catalog";

afterEach(() => vi.unstubAllGlobals());

describe("catalog search", () => {
  it("sends trimmed search, attribute, pagination, term, and hide-full filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      sections: [], pagination: { limit: 50, offset: 50, has_more: false },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await searchCatalogSections(
      { term_season: "SPRING", term_year: 2027 }, "  PHILO 230  ", 50, undefined, "  Writing Intensive  ", true,
    );
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://local.test");
    expect(url.pathname).toBe("/api/catalog/sections");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      term_season: "SPRING", term_year: "2027", limit: "50", offset: "50",
      q: "PHILO 230", attribute: "Writing Intensive", hide_full: "true",
    });
  });

  it("leaves hide-full off by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      sections: [], pagination: { limit: 50, offset: 0, has_more: false },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await searchCatalogSections({ term_season: "SPRING", term_year: 2027 });

    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://local.test");
    expect(url.searchParams.has("hide_full")).toBe(false);
  });

  it("surfaces a failed catalog response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 503 })));
    await expect(searchCatalogSections({ term_season: "SPRING", term_year: 2027 }))
      .rejects.toThrow("Catalog request failed with status 503");
  });
});
