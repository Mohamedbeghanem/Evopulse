import { ACTION_CATALOG, type CatalogActionType } from "./types";

const CATALOG = new Set<string>(ACTION_CATALOG);

export function isCatalogAction(type: string): type is CatalogActionType {
  return CATALOG.has(type);
}

export function assertCatalogAction(type: string): CatalogActionType {
  if (!isCatalogAction(type)) {
    throw new Error(`Unknown action type "${type}". Planner may only choose from the action catalog.`);
  }
  return type;
}
