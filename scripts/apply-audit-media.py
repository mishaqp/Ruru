#!/usr/bin/env python3
"""One-shot feature branch patch; no local checkout or model requests."""
from pathlib import Path


def replace(filename, old, new, expected=1):
    path = Path(filename)
    source = path.read_text()
    if old not in source and new in source:
        return
    assert source.count(old) == expected, f"{filename}: expected {expected}, got {source.count(old)} for {old[:70]}"
    path.write_text(source.replace(old, new))


video = "extensions/pi-web-access/video-extract.ts"
youtube = "extensions/pi-web-access/youtube-extract.ts"
extract = "extensions/pi-web-access/extract.ts"
for filename in [video, youtube]:
    replace(filename, 'import { execFileSync } from "node:child_process";', 'import { runMediaProcess } from "./media-process.ts";')
    replace(filename, 'const buffer = execFileSync("ffmpeg", [', 'const buffer = await runMediaProcess("ffmpeg", [')
replace(video,
    'export async function extractVideoFrame(filePath: string, seconds: number = 1): Promise<FrameResult>',
    'export async function extractVideoFrame(filePath: string, seconds: number = 1, signal?: AbortSignal): Promise<FrameResult>')
replace(video,
    'export async function getLocalVideoDuration(filePath: string): Promise<number | { error: string }>',
    'export async function getLocalVideoDuration(filePath: string, signal?: AbortSignal): Promise<number | { error: string }>')
replace(video, 'await extractVideoFrame(info.absolutePath);', 'await extractVideoFrame(info.absolutePath, 1, signal);')
replace(video,
    '], { maxBuffer: 5 * 1024 * 1024, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });',
    '], { maxBuffer: 5 * 1024 * 1024, timeout: 10000, signal });')
replace(video, 'const output = execFileSync("ffprobe", [', 'const output = (await runMediaProcess("ffprobe", [')
replace(video,
    '], { timeout: 10000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();',
    '], { timeout: 10000, signal })).toString("utf8").trim();')
replace(youtube,
    'export async function getYouTubeStreamInfo(videoId: string): Promise<StreamResult>',
    'export async function getYouTubeStreamInfo(videoId: string, signal?: AbortSignal): Promise<StreamResult>')
replace(youtube, 'const output = execFileSync("yt-dlp", [', 'const output = (await runMediaProcess("yt-dlp", [')
replace(youtube,
    '], { timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();',
    '], { timeout: 15000, signal })).toString("utf8").trim();')
replace(youtube,
    'async function extractFrameFromStream(streamUrl: string, seconds: number): Promise<FrameResult>',
    'async function extractFrameFromStream(streamUrl: string, seconds: number, signal?: AbortSignal): Promise<FrameResult>')
replace(youtube,
    '], { maxBuffer: 5 * 1024 * 1024, timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });',
    '], { maxBuffer: 5 * 1024 * 1024, timeout: 30000, signal });')
replace(youtube, '\tstreamInfo?: StreamInfo,\n', '\tstreamInfo?: StreamInfo,\n\tsignal?: AbortSignal,\n', 2)
replace(youtube, 'await getYouTubeStreamInfo(videoId);', 'await getYouTubeStreamInfo(videoId, signal);', 2)
replace(youtube, 'return extractFrameFromStream(info.streamUrl, seconds);', 'return extractFrameFromStream(info.streamUrl, seconds, signal);')
replace(youtube, 'await extractFrameFromStream(info.streamUrl, t);', 'await extractFrameFromStream(info.streamUrl, t, signal);')
replace(extract, '\tfilePath: string, timestamps: number[],\n', '\tfilePath: string, timestamps: number[], signal?: AbortSignal,\n')
replace(extract, 'await extractVideoFrame(filePath, t);', 'await extractVideoFrame(filePath, t, signal);')
replace(extract, 'await getYouTubeStreamInfo(ytInfo.videoId);', 'await getYouTubeStreamInfo(ytInfo.videoId, signal);', 2)
replace(extract, 'await extractYouTubeFrames(ytInfo.videoId, timestamps, streamInfo);', 'await extractYouTubeFrames(ytInfo.videoId, timestamps, streamInfo, signal);', 3)
replace(extract, 'await extractYouTubeFrame(ytInfo.videoId, spec.seconds, streamInfo);', 'await extractYouTubeFrame(ytInfo.videoId, spec.seconds, streamInfo, signal);')
replace(extract, 'await getLocalVideoDuration(localVideo.info.absolutePath);', 'await getLocalVideoDuration(localVideo.info.absolutePath, signal);')
replace(extract, 'await extractLocalFrames(localVideo.info.absolutePath, timestamps);', 'await extractLocalFrames(localVideo.info.absolutePath, timestamps, signal);', 3)
replace(extract, 'await extractVideoFrame(localVideo.info.absolutePath, spec.seconds);', 'await extractVideoFrame(localVideo.info.absolutePath, spec.seconds, signal);')

# A filesystem read error is not an empty directory. Fail before swapping any
# installed files, rather than accidentally dropping unreadable user extras.
installer = "app/src/main/java/com/zhousl/aether/runtime/BundledExtensionInstaller.kt"
replace(installer, 'for (entry in directory.listFiles().orEmpty()) {',
    'for (entry in checkNotNull(directory.listFiles()) { "Unable to read bundled extension directory." }) {', 2)
print("Applied cancellable media process plumbing and fail-closed directory reads.")
