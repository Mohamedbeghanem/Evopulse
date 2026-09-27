import { AUTOPILOT_THRESHOLDS, type ClassifyInput, type ClassifyResult } from "./types";

/**
 * Deterministic Autopilot matrix. An LLM must never assign these states.
 * ACTION EXECUTED is not HANDLED — only verification SUCCESS is.
 */
export function classifySituation(input: ClassifyInput): ClassifyResult {
  if (input.verificationStatus === "SUCCESS") {
    return {
      classification: "HANDLED",
      reasonCode: "VERIFIED_RESOLVED",
      explanation: "Verification succeeded. The underlying issue is resolved.",
    };
  }

  if (input.verificationStatus === "FAILED") {
    return {
      classification: "NEEDS_YOU",
      reasonCode: "VERIFICATION_FAILED",
      explanation: "Verification failed. The situation re-enters the control loop — it is not handled.",
    };
  }

  if (input.exceptionKind === "policy_blocked" || (input.hasBlockedAction && !input.hasApprovalRequired && input.exceptionKind !== "commitment_missed")) {
    return {
      classification: "BLOCKED",
      reasonCode: "POLICY_BLOCKED",
      explanation: "Policy prevented the proposed action. This is successful governance, not a system failure.",
    };
  }

  if (
    input.isSupplierCascade ||
    input.exceptionKind === "delivery_delay" ||
    (input.affectedOrders >= AUTOPILOT_THRESHOLDS.HIGH_IMPACT_ORDERS &&
      input.associatedRevenue >= AUTOPILOT_THRESHOLDS.HIGH_IMPACT_REVENUE &&
      input.hasException &&
      input.exceptionKind !== "commitment_missed" &&
      input.exceptionKind !== "policy_blocked")
  ) {
    return {
      classification: "NEEDS_YOU",
      reasonCode: "HIGH_IMPACT_HUMAN_JUDGMENT",
      explanation: "Multiple legitimate recovery tradeoffs exist. EvoPulse prepared context; a human chooses the strategy.",
    };
  }

  if (input.verificationStatus === "PENDING") {
    return {
      classification: "MONITORING",
      reasonCode: "VERIFICATION_PENDING",
      explanation: "An action executed. Resolution is not claimed until verification succeeds.",
    };
  }

  if (input.hasFinancialApproval) {
    return {
      classification: "NEEDS_APPROVAL",
      reasonCode: "FINANCIAL_ACTION_REQUIRES_APPROVAL",
      explanation: "A financial action is ready but policy requires explicit approval.",
    };
  }

  if (input.hasApprovalRequired) {
    return {
      classification: "NEEDS_APPROVAL",
      reasonCode: "EXTERNAL_ACTION_REQUIRES_APPROVAL",
      explanation: "Recovery is prepared. External customer communication still requires approval.",
    };
  }

  if (input.hasBlockedAction) {
    return {
      classification: "BLOCKED",
      reasonCode: "POLICY_BLOCKED",
      explanation: "Policy blocked a proposed action.",
    };
  }

  if (input.hasAutoExecuted && !input.hasApprovalRequired) {
    return {
      classification: "AUTO_HANDLED",
      reasonCode: "SAFE_INTERNAL_ACTION",
      explanation: "A policy-AUTO internal action executed. This is not verification of the business outcome.",
    };
  }

  if (input.hasPlan && !input.hasAutoExecuted) {
    return {
      classification: "PREPARED",
      reasonCode: "ACTION_PREPARED",
      explanation: "A structured response is prepared. Execution has not occurred.",
    };
  }

  if (input.warningActive && input.deadlineFuture && input.bufferState !== "MISSED") {
    return {
      classification: "MONITORING",
      reasonCode: "EARLY_WARNING_MONITORING",
      explanation: "A future commitment is at risk under current timing assumptions. Intervention is not yet justified.",
    };
  }

  if (input.hasException) {
    return {
      classification: "NEEDS_YOU",
      reasonCode: "HIGH_IMPACT_HUMAN_JUDGMENT",
      explanation: "An exception is open and needs a human decision.",
    };
  }

  return {
    classification: "NORMAL",
    reasonCode: "NO_INTERVENTION_REQUIRED",
    explanation: "No warning and no exception. The event stays in activity; it does not need attention.",
  };
}
