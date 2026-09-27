import type { BusinessEvent, EventHandler } from "./types";

/**
 * In-process dispatcher. After persist, EventService notifies subscribers.
 * PR #3+ engines (graph, twin, pulse matchers) subscribe here — do not put
 * those engines in this PR. Handlers must be idempotent on event.id.
 */
export class EventDispatcher {
  private readonly typed = new Map<string, Set<EventHandler>>();
  private readonly any = new Set<EventHandler>();
  /** Most recent dispatch, including replays — useful for tests and later engines. */
  readonly journal: BusinessEvent[] = [];

  on(type: string | "*", handler: EventHandler): () => void {
    if (type === "*") {
      this.any.add(handler);
      return () => this.any.delete(handler);
    }
    let set = this.typed.get(type);
    if (!set) {
      set = new Set();
      this.typed.set(type, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  off(type: string | "*", handler: EventHandler) {
    if (type === "*") this.any.delete(handler);
    else this.typed.get(type)?.delete(handler);
  }

  reset() {
    this.typed.clear();
    this.any.clear();
    this.journal.length = 0;
  }

  dispatch(event: BusinessEvent) {
    this.journal.push(event);
    const handlers = [...this.any, ...(this.typed.get(event.type) ?? [])];
    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result && typeof result.then === "function") {
          void result.catch((error) => {
            console.error("[event-dispatcher] handler failed", event.id, event.type, error);
          });
        }
      } catch (error) {
        console.error("[event-dispatcher] handler failed", event.id, event.type, error);
      }
    }
  }
}

const globalForEvents = globalThis as unknown as { evopulseDispatcher?: EventDispatcher };

export function getDispatcher(): EventDispatcher {
  if (!globalForEvents.evopulseDispatcher) {
    globalForEvents.evopulseDispatcher = new EventDispatcher();
  }
  return globalForEvents.evopulseDispatcher;
}

/** Named hook so later engines can subscribe without importing the singleton internals. */
export function registerEngineHook(name: string, handler: EventHandler): () => void {
  const wrapped: EventHandler = (event) => handler(event);
  Object.defineProperty(wrapped, "name", { value: name });
  return getDispatcher().on("*", wrapped);
}
