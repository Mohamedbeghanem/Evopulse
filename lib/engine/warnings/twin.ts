import { formatCompactAmount } from "./present";
import type { BusinessTwin, WarningView } from "./types";

/** Domain state from active warnings. No health percentages. */
export function businessTwin(warnings: WarningView[]): BusinessTwin {
  const active = warnings.filter((warning) => warning.status === "ACTIVE");
  const delivery = active.filter((warning) => warning.kind === "delivery_shortfall");
  const atRisk = delivery.flatMap((warning) => warning.children.filter((child) => child.state === "AT_RISK"));
  const tightBuffers = delivery.flatMap((warning) =>
    warning.children.filter((child) => child.state === "AT_RISK" || child.state === "TIGHT"),
  );
  const cash = delivery.reduce((sum, warning) => sum + warning.cashAmount, 0);

  return {
    operations:
      atRisk.length > 0
        ? {
            status: "AT RISK",
            line: `${atRisk.length} ${atRisk.length === 1 ? "dependency" : "dependencies"} approaching failure`,
          }
        : { status: "CLEAR", line: "No dependency is approaching failure" },
    customers:
      tightBuffers.length > 0
        ? {
            status: "MONITORING",
            line: `${tightBuffers.length} ${tightBuffers.length === 1 ? "commitment" : "commitments"} with tight buffers`,
          }
        : { status: "CLEAR", line: "No commitment buffer is tight" },
    cash:
      cash > 0
        ? {
            status: "MONITORING",
            line: `${formatCompactAmount(cash)} timing dependent on at-risk delivery`,
          }
        : { status: "CLEAR", line: "No cash timing depends on an at-risk delivery" },
  };
}
