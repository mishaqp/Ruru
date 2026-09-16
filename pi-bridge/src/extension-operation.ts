import { AsyncLocalStorage } from "node:async_hooks";

type Phase = "render" | "action" | "event" | "cleanup" | "load";
interface Operation { timeoutError?: Error }
const operationContext = new AsyncLocalStorage<Operation>();
const deadlines: Record<Phase, number> = {
  render: 10_000,
  action: 120_000,
  event: 30_000,
  cleanup: 5_000,
  load: 120_000,
};

function timeoutMillis(phase: Phase): number {
  const testOverride = Number(process.env.RURU_EXTENSION_TEST_TIMEOUT_MS);
  return process.env.NODE_ENV === "test" && Number.isFinite(testOverride) && testOverride >= 20 && testOverride <= 1_000
    ? testOverride
    : deadlines[phase];
}

/** Bounds an asynchronous wait, not arbitrary synchronous JS or external effects.
 * A timed-out continuation retains its failed scope, so subsequent API calls are
 * rejected. Successful detached callbacks intentionally retain normal behaviour.
 */
export async function withExtensionDeadline<T>(
  phase: Phase,
  extensionId: string,
  operation: () => T | Promise<T>,
): Promise<T> {
  const scope: Operation = {};
  const timeout = timeoutMillis(phase);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      scope.timeoutError = new Error(`Extension ${phase} timed out after ${timeout}ms: ${extensionId}`);
      reject(scope.timeoutError);
    }, timeout);
  });
  try {
    // Promise.race attaches rejection handlers to the abandoned operation too.
    // This avoids unhandled rejections when its guarded continuation runs late.
    return await Promise.race([
      Promise.resolve().then(() => operationContext.run(scope, operation)),
      expired,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function assertLiveOperation(): void {
  const error = operationContext.getStore()?.timeoutError;
  if (error) throw error;
}

/** Guard at invocation time (including destructured methods and disposers).
 * This is a reliability fence for cooperative extensions, not a JS sandbox.
 */
export function guardExtensionApi<T extends object>(api: T): T {
  const proxies = new WeakMap<object, object>();
  const wrap = <O extends object>(object: O): O => {
    const existing = proxies.get(object);
    if (existing) return existing as O;
    const methods = new Map<PropertyKey, { source: unknown; wrapped: unknown }>();
    const proxy = new Proxy(object, {
      get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        if (typeof value === "function") {
          const cached = methods.get(key);
          if (cached?.source === value) return cached.wrapped;
          const wrapped = (...args: unknown[]) => {
            assertLiveOperation();
            const result: unknown = Reflect.apply(value, target, args);
            if (typeof result !== "function") return result;
            return (...disposeArgs: unknown[]) => {
              assertLiveOperation();
              return Reflect.apply(result, undefined, disposeArgs);
            };
          };
          methods.set(key, { source: value, wrapped });
          return wrapped;
        }
        return value && typeof value === "object" ? wrap(value) : value;
      },
    });
    proxies.set(object, proxy);
    return proxy;
  };
  return wrap(api);
}
