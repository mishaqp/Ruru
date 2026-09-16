import { execFile } from "node:child_process";

// ffmpeg is memory intensive on Android. Yield the event loop and bound the
// number of children instead of running synchronous commands inside async APIs.
const MAX_MEDIA_PROCESSES = 2;
let active = 0;
const waiting: Array<() => void> = [];

function acquire(signal?: AbortSignal): Promise<() => void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      const index = waiting.indexOf(start);
      if (index >= 0) waiting.splice(index, 1);
      reject(signal?.reason ?? new Error("Aborted"));
    };
    const start = () => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted) {
        reject(signal.reason);
        drain();
        return;
      }
      active++;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        active--;
        drain();
      });
    };
    if (active < MAX_MEDIA_PROCESSES) start();
    else {
      waiting.push(start);
      signal?.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function drain(): void {
  while (active < MAX_MEDIA_PROCESSES && waiting.length > 0) waiting.shift()?.();
}

export async function runMediaProcess(
  command: string,
  args: string[],
  options: { timeout: number; maxBuffer?: number; signal?: AbortSignal },
): Promise<Buffer> {
  const release = await acquire(options.signal);
  try {
    options.signal?.throwIfAborted();
    return await new Promise<Buffer>((resolve, reject) => {
      execFile(command, args, {
        encoding: "buffer",
        timeout: options.timeout,
        maxBuffer: options.maxBuffer ?? 1024 * 1024,
        signal: options.signal,
        // The commands run directly without a shell. Cancellation/timeout must
        // not leave a media process occupying memory after its owner stopped.
        killSignal: "SIGKILL",
        windowsHide: true,
      }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  } finally {
    release();
  }
}
