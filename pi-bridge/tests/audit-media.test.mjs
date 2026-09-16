import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { build } from "esbuild";

const stubs = {
  "./activity.ts": "export const activityMonitor={logStart(){return 'x'},logComplete(){},logError(){}};",
  "./gemini-web.ts": "export const isGeminiWebAvailable=async()=>false; export const queryWithCookies=async()=>'';",
  "./gemini-api.ts": "export const queryGeminiApiWithVideo=async()=>''; export const getApiKey=async()=>''; export const fetchGeminiApi=async()=>{}; export const API_BASE=''; export const redactGeminiApiResponse=x=>x;",
  "./extract.ts": "export const extractHeadingTitle=()=>undefined;",
  "./utils.ts": "export const readExecError=e=>({code:e.code,stderr:e.stderr,message:e.message}); export const trimErrorText=x=>x; export const mapFfmpegError=e=>e.message; export const getWebSearchConfigPath=()=>'/no-fixture-config';",
};
const bundled = await build({
  entryPoints: [resolve("../extensions/pi-web-access/video-extract.ts")], bundle: true,
  platform: "node", format: "esm", write: false,
  plugins: [{ name: "video-fixture", setup(b) {
    b.onResolve({ filter: /.*/ }, a => Object.hasOwn(stubs, a.path) ? { path: a.path, namespace: "fixture" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({ contents: stubs[a.path], loader: "js" }));
  } }],
});
const video = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

async function withFakeMedia(run) {
  const root = await mkdtemp(join(tmpdir(), "ruru-media-"));
  const bin = join(root, "bin");
  const log = join(root, "calls.log");
  const previousPath = process.env.PATH;
  const previousLog = process.env.RURU_MEDIA_LOG;
  try {
    await mkdir(bin);
    await writeFile(log, "");
    const script = `#!${process.execPath}\nconst fs=require('node:fs'); fs.appendFileSync(process.env.RURU_MEDIA_LOG, 'start\\n'); setTimeout(()=>{fs.appendFileSync(process.env.RURU_MEDIA_LOG, 'end\\n');process.stdout.write(Buffer.from([255,216,255]));},180);\n`;
    for (const name of ["ffmpeg", "ffprobe"]) {
      await writeFile(join(bin, name), script);
      await chmod(join(bin, name), 0o755);
    }
    process.env.PATH = `${bin}:${previousPath}`;
    process.env.RURU_MEDIA_LOG = log;
    await run(log);
  } finally {
    if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
    if (previousLog === undefined) delete process.env.RURU_MEDIA_LOG; else process.env.RURU_MEDIA_LOG = previousLog;
    await rm(root, { recursive: true, force: true });
  }
}

test("R03: a video frame does not block the Node event loop", async () => withFakeMedia(async () => {
  let timerFired = false;
  const timer = setTimeout(() => { timerFired = true; }, 10);
  try {
    const frame = await video.extractVideoFrame("fixture.mp4", 1);
    assert.ok("data" in frame, JSON.stringify(frame));
    assert.equal(timerFired, true, "video processing blocked the event loop");
  } finally { clearTimeout(timer); }
}));

test("R03: already cancelled frame extraction never starts ffmpeg", async () => withFakeMedia(async log => {
  const controller = new AbortController();
  controller.abort();
  const result = await video.extractVideoFrame("fixture.mp4", 1, controller.signal);
  assert.ok("error" in result, "cancelled media was executed");
  assert.equal(await readFile(log, "utf8"), "");
}));

test("R03: cancelling active frame extraction stops the child process", async () => withFakeMedia(async log => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50);
  try {
    const result = await video.extractVideoFrame("fixture.mp4", 1, controller.signal);
    assert.ok("error" in result, "cancelled media completed successfully");
    await new Promise(resolve => setTimeout(resolve, 220));
    assert.equal((await readFile(log, "utf8")).includes("end"), false, "child survived cancellation");
  } finally { clearTimeout(timer); }
}));

test("R03: simultaneous frame requests use at most two child processes", async () => withFakeMedia(async log => {
  const frames = await Promise.all(Array.from({ length: 6 }, (_, index) => video.extractVideoFrame("fixture.mp4", index)));
  assert.ok(frames.every(frame => "data" in frame));
  let active = 0;
  let peak = 0;
  for (const event of (await readFile(log, "utf8")).trim().split("\n")) {
    active += event === "start" ? 1 : -1;
    peak = Math.max(peak, active);
  }
  assert.equal(active, 0);
  assert.ok(peak <= 2, `too many simultaneous media processes: ${peak}`);
}));
