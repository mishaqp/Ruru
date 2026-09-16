import type { AetherExtensionAPI } from '../../packages/extension-api/src/index.js';

export type ExtensionPhase = 'load' | 'render' | 'action' | 'event' | 'cleanup';
const DEFAULT_TIMEOUTS: Record<ExtensionPhase, number> = {
  load: 30_000,
  render: 5_000,
  action: 120_000,
  event: 60_000,
  cleanup: 5_000,
};
const TIMEOUTS = Object.fromEntries(Object.entries(DEFAULT_TIMEOUTS).map(([phase, fallback]) => {
  const raw = process.env[`RURU_EXTENSION_${phase.toUpperCase()}_TIMEOUT_MS`];
  const value = raw ? Number(raw) : fallback;
  // Operator overrides are bounded too. Read once, before loading user modules.
  return [phase, Number.isInteger(value) && value >= 20 && value <= 900_000 ? value : fallback];
})) as Record<ExtensionPhase, number>;

/**
 * One lease per loaded extension instance, never reused after reload.
 * Revocation fences SDK side effects from late callbacks. It cannot terminate
 * arbitrary JS/native code or undo external operations already submitted.
 */
export class ExtensionExecution {
  private readonly controller = new AbortController();
  private failure?: Error;

  constructor(private readonly owner: string) {}

  get active(): boolean { return this.failure === undefined; }
  get signal(): AbortSignal { return this.controller.signal; }
  get error(): Error { return this.failure ?? new Error(`Extension ${this.owner} is inactive.`); }

  revoke(reason = new Error(`Extension ${this.owner} was disposed.`)): void {
    if (this.failure) return;
    this.failure = reason;
    this.controller.abort(reason);
  }

  async run<T>(phase: ExtensionPhase, operation: () => T | Promise<T>): Promise<T> {
    // Disposers must still get a chance to release external resources, even
    // after a timeout. SDK mutations remain revoked during that cleanup.
    if (!this.active && phase !== 'cleanup') throw this.error;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const error = new Error(`Extension ${this.owner} ${phase} timed out after ${TIMEOUTS[phase]} ms. Reload the extension to recover.`);
        this.revoke(error);
        reject(error);
      }, TIMEOUTS[phase]);
      Promise.resolve().then(operation).then(
        value => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        error => {
          // Always consume the original rejection, including after timeout.
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}

/** Retain pure UI helpers/read-only storage and teardown disposers after revoke. */
export function guardExtensionApi(api: AetherExtensionAPI, execution: ExtensionExecution): AetherExtensionAPI {
  const groups = new Set(['host', 'services', 'state', 'storage', 'messages']);
  const asyncGroups = new Set(['host', 'services', 'state', 'messages']);
  const wrap = <T extends object>(object: T, group = ''): T => {
    const wrappers = new Map<PropertyKey, unknown>();
    return new Proxy(object, {
      get(target, property, receiver) {
        const value: unknown = Reflect.get(target, property, receiver);
        if (wrappers.has(property)) return wrappers.get(property);
        const name = String(property);
        if (!group && groups.has(name) && value && typeof value === 'object') {
          const nested = wrap(value, name);
          wrappers.set(property, nested);
          return nested;
        }
        if (typeof value !== 'function') return value;
        const wrapped = (...args: unknown[]) => {
          const readOnlyStorage = group === 'storage' && (name === 'get' || name === 'snapshot');
          if (execution.active || readOnlyStorage) return Reflect.apply(value, target, args);
          if (asyncGroups.has(group)) {
            const rejected = Promise.reject(execution.error);
            // A fire-and-forget call from an expired callback must not crash the
            // process. Awaiting the SAME promise still receives the rejection.
            void rejected.catch(() => {});
            return rejected;
          }
          if (!group && (name.startsWith('register') || name === 'on' || name === 'intercept')) {
            return () => {};
          }
          // Expired timers may still attempt invalidate/notify/storage writes.
          // Ignore those side effects; the original timeout is already reported.
          return undefined;
        };
        wrappers.set(property, wrapped);
        return wrapped;
      },
    });
  };
  return wrap(api);
}
