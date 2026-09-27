/**
 * Errors that carry the HTTP status they should surface as.
 *
 * Routes previously recovered the status by running regexes over error.message, which meant a
 * reworded message silently changed the contract and any unexpected internal fault was reported
 * to the client as a 4xx. The status belongs to whoever raises the error, not to the text.
 */
export class AgentError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AgentError";
    this.status = status;
  }
}

/** The caller named something that does not exist. */
export function agentNotFound(what: string): AgentError {
  return new AgentError(`${what} not found`, 404);
}

/** The target exists but is no longer in a state that accepts this decision. */
export function agentConflict(message: string): AgentError {
  return new AgentError(message, 409);
}

/** The request was understood but is not a valid decision. */
export function agentBadRequest(message: string): AgentError {
  return new AgentError(message, 400);
}

/** Our own data is inconsistent. Never the caller's fault, so never a 4xx. */
export function agentInvariant(message: string): AgentError {
  return new AgentError(message, 500);
}
