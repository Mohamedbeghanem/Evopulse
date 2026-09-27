import { IDS } from "../ids";
import type { ExceptionRow } from "../types";
import type { WarningRow } from "../warnings";

/**
 * Deterministic situation identity.
 * Folds a warning into the exception that owns the same expectation or the
 * shipment-rooted cascade. Does not merge 320K and 10% by shared opportunity_id.
 */
export function situationKey(
  exceptions: ExceptionRow[],
  warnings: WarningRow[],
  exception: ExceptionRow | undefined,
  warning: WarningRow | undefined,
  fallbackId?: string,
): string {
  if (exception) {
    return `exception:${canonicalExceptionId(exceptions, warnings, exception)}`;
  }
  if (warning) {
    const owner = exceptionOwningWarning(exceptions, warnings, warning);
    if (owner) return `exception:${canonicalExceptionId(exceptions, warnings, owner)}`;
    return `warning:${warning.id}`;
  }
  return `decision:${fallbackId || "unknown"}`;
}

export function canonicalExceptionId(
  exceptions: ExceptionRow[],
  warnings: WarningRow[],
  exception: ExceptionRow,
): string {
  const linked = warningForExpectation(warnings, exception.expectation_id);
  const owner = exceptionForRoot(exceptions, rootEntity(linked));
  if (owner && owner.id !== exception.id) return owner.id;
  return exception.id;
}

export function exceptionOwningWarning(
  exceptions: ExceptionRow[],
  warnings: WarningRow[],
  warning: WarningRow,
): ExceptionRow | undefined {
  if (warning.expectation_id) {
    const sameExpectation = exceptions.find(
      (row) => row.status !== "resolved" && row.expectation_id === warning.expectation_id,
    );
    if (sameExpectation) return exceptions.find((row) => row.id === canonicalExceptionId(exceptions, warnings, sameExpectation)) || sameExpectation;
  }
  return exceptionForRoot(exceptions, rootEntity(warning));
}

export function warningForExpectation(warnings: WarningRow[], expectationId: string | null): WarningRow | undefined {
  if (!expectationId) return undefined;
  return warnings.find((row) => row.expectation_id === expectationId);
}

export function rootEntity(warning: WarningRow | undefined): string | null {
  if (!warning) return null;
  const meta = parseJson(warning.metadata);
  return typeof meta.root_entity_id === "string" && meta.root_entity_id ? meta.root_entity_id : null;
}

function exceptionForRoot(exceptions: ExceptionRow[], root: string | null): ExceptionRow | undefined {
  if (!root) return undefined;
  const open = exceptions.filter((row) => row.status !== "resolved");
  if (root === IDS.shipment) {
    return open.find(
      (row) => row.id === IDS.excDelay || row.kind === "delivery_delay" || row.opportunity_id === IDS.shipment,
    );
  }
  return undefined;
}

export function parseJson(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
