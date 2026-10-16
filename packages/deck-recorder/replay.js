#!/usr/bin/env node
// Turns a <deck-recorder> recording into a video. The recording's flow
// (recording-<time>.json, a Puppeteer Replay user flow with `t` on each step)
// is replayed in time in Chrome, with its video playing in the page's
// <webcam-view>; the page is screen-recorded and the recording's sound laid
// under it. Writes <title>.mp4 next to the flow.
//
//   node replay.js recording-<time>.json [--out video.mp4] [--headed]

import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import {
  createRunner,
  PuppeteerRunnerExtension,
  selectorToPElementSelector,
} from "@puppeteer/replay";
import puppeteer from "puppeteer";

const CHUNK = 4 << 20;
const epochMs = () => performance.timeOrigin + performance.now();
const wait = (until) => sleep(Math.max(0, until - epochMs()));

const {
  values: opt,
  positionals: [file],
} = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" }, headed: { type: "boolean" } },
});
if (!file) {
  console.error(
    "usage: node replay.js recording-<time>.json [--out video.mp4] [--headed]",
  );
  process.exit(1);
}

const dir = dirname(resolve(file));
const flow = JSON.parse(await readFile(file, "utf8"));
for (const step of flow.steps) {
  if (step.type !== "navigate") continue;
  const url = new URL(step.url);
  url.searchParams.set("replay", "");
  step.url = url.href;
}
const video = await readFile(join(dir, flow.video));
const screen = join(dir, `${flow.title}.screen.webm`);
const out = resolve(opt.out ?? join(dir, `${flow.title}.mp4`));

// Plays the webcam video in the page's <webcam-view>, paused at the start.
async function load(page) {
  await page.exposeFunction("__recordingChunk", (i) =>
    video.subarray(i * CHUNK, (i + 1) * CHUNK).toString("base64"),
  );
  await page.evaluate(
    async (size, chunk, type) => {
      const cam = document.querySelector("webcam-view");
      if (!cam) return;
      const parts = [];
      for (let i = 0; i * chunk < size; i++) {
        parts.push(Uint8Array.fromBase64(await window.__recordingChunk(i)));
      }
      cam.src = URL.createObjectURL(new Blob(parts, { type }));
      const v = cam.video;
      if (v.readyState < 3) {
        await new Promise((ok, fail) => {
          v.addEventListener("canplay", ok, { once: true });
          v.addEventListener("error", () => fail(v.error), { once: true });
        });
      }
      v.pause();
      v.currentTime = 0;
    },
    video.length,
    CHUNK,
    flow.video.endsWith(".mp4") ? "video/mp4" : "video/webm",
  );
}

const measureVideoStart = (page) =>
  page.evaluate(() => {
    const video = document.querySelector("webcam-view")?.video;
    if (!video || video.paused) return null;
    return (
      performance.timeOrigin + performance.now() - video.currentTime * 1000
    );
  });

// Runs each step at its `t`, counted from when the video starts: just after
// the first navigation, once the deck is ready.
class Timed extends PuppeteerRunnerExtension {
  t0 = null;
  recorder = null;
  captured = 0;
  clickTarget = null;

  async waitUntil(videoMs) {
    await wait(this.t0 + videoMs);
    this.t0 = (await measureVideoStart(this.page)) || this.t0;
    await wait(this.t0 + videoMs);
  }

  async beforeEachStep(step, flow) {
    if (step.type === "click") {
      this.clickTarget = await this.page
        .locatorRace(
          step.selectors.map((selector) =>
            this.page.locator(selectorToPElementSelector(selector)),
          ),
        )
        .setTimeout(this.timeout)
        .waitHandle();
    }
    if (this.t0 !== null) await this.waitUntil(step.t);
    await super.beforeEachStep?.(step, flow);
  }

  async runStep(step, flow) {
    if (step.type !== "click") return super.runStep(step, flow);
    const { x, y } = await this.clickTarget.clickablePoint({
      x: step.offsetX,
      y: step.offsetY,
    });
    await this.page.mouse.click(x, y);
    await this.clickTarget.dispose();
  }

  async afterEachStep(step, flow) {
    await super.afterEachStep?.(step, flow);
    if (this.t0 !== null || step.type !== "navigate") return;
    const { page } = this;
    await page.evaluate(() => document.querySelector("deck-shift")?.ready);
    await load(page);
    this.recorder = await page.screencast({ path: screen });
    this.captured = epochMs();
    await page.evaluate(() =>
      document.querySelector("webcam-view")?.video.play(),
    );
    this.t0 = epochMs();
  }
}

const browser = await puppeteer.launch({
  headless: !opt.headed,
  acceptInsecureCerts: true,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--enable-gpu",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error(`page: ${e.message}`));
  const timed = new Timed(browser, page);
  await (await createRunner(flow, timed)).run();
  // minimal: real-time capture, so frames can lag a slow machine; seek every
  // animation per frame (as ../demo's renderer does) if that shows.
  await timed.waitUntil(flow.duration);
  await timed.recorder.stop();
  const offset = (timed.t0 - timed.captured) / 1000;
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-ss",
      `${offset}`,
      "-i",
      screen,
      "-i",
      join(dir, flow.video),
      "-map",
      "0:v",
      "-map",
      "1:a:0",
      "-t",
      `${flow.duration / 1000}`,
      "-vf",
      "pad=ceil(iw/2)*2:ceil(ih/2)*2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      out,
    ],
    { stdio: "inherit" },
  );
  const code = await new Promise((ok) => ffmpeg.on("exit", ok));
  if (code) throw new Error(`ffmpeg exited with ${code}`);
  await rm(screen);
  console.log(out);
} finally {
  await browser.close();
}
