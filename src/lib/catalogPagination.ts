import type { CatalogSection } from "./catalog";

export interface CatalogPaginationGuard {
  beginDataset: () => number;
  currentDataset: () => number;
  accepts: (generation: number) => boolean;
}

export function createCatalogPaginationGuard(): CatalogPaginationGuard {
  let generation = 0;

  return {
    beginDataset() {
      generation += 1;
      return generation;
    },
    currentDataset() {
      return generation;
    },
    accepts(candidate) {
      return candidate === generation;
    },
  };
}

export function appendUniqueCatalogSections(
  current: CatalogSection[],
  incoming: CatalogSection[],
) {
  return [
    ...current,
    ...incoming.filter((section) => (
      !current.some((candidate) => candidate.class_num === section.class_num)
    )),
  ];
}
