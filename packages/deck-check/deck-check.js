#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import puppeteer from "puppeteer";

const {
  values: opt,
  positionals: [target],
} = parseArgs({
  allowPositionals: true,
  options: {
    sheet: { type: "string" },
    cols: { type: "string", default: "4" },
    "no-webfonts": { type: "boolean" },
  },
});

if (!target) {
  console.error(
    "usage: deck-check <deck.html | url> [--sheet sheet.png] [--cols 4] [--no-webfonts]",
  );
  process.exit(2);
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
};

let server;
let url = target;
if (!/^https?:/.test(target)) {
  const root = process.cwd();
  const file = relative(root, resolve(target));
  if (file.startsWith("..")) {
    console.error(`${target} is outside ${root}; run from a directory above it`);
    process.exit(2);
  }
  server = createServer(async (req, res) => {
    const path = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    try {
      const body = await readFile(path);
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(req.url === "/favicon.ico" ? 204 : 404).end();
    }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  url = `http://127.0.0.1:${server.address().port}/${file.split(sep).join("/")}`;
}

function lint() {
  const deck = document.querySelector("deck-shift");
  const stage = deck.shadowRoot.querySelector("[part=stage]");
  const S = stage.getBoundingClientRect();
  const k = S.width / stage.offsetWidth;
  const W = stage.offsetWidth;
  const H = stage.offsetHeight;
  const section = deck.slides[deck.slide];
  const found = [];
  const at = (r) => ({
    l: (r.left - S.left) / k,
    t: (r.top - S.top) / k,
    r: (r.right - S.left) / k,
    b: (r.bottom - S.top) / k,
  });
  const label = (el) =>
    el.localName +
    (el.id ? `#${el.id}` : "") +
    [...el.classList].map((c) => `.${c}`).join("");
  const add = (level, kind, el, detail) =>
    found.push({ level, kind, el: label(el), detail });
  const shown = (el) =>
    el.checkVisibility({ visibilityProperty: true, opacityProperty: true });

  const texts = [];
  const walk = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const node = walk.currentNode;
    const el = node.parentElement;
    const text = node.data.replace(/\s+/g, " ").trim();
    if (!text || !shown(el)) continue;
    if (el.closest("aside.notes, script, style, template, [data-lint-skip]"))
      continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()]
      .filter((r) => r.width && r.height)
      .map(at);
    if (!rects.length) continue;
    const box = {
      l: Math.min(...rects.map((r) => r.l)),
      t: Math.min(...rects.map((r) => r.t)),
      r: Math.max(...rects.map((r) => r.r)),
      b: Math.max(...rects.map((r) => r.b)),
    };
    texts.push({ node, el, text, rects, box });
  }

  const snip = (t) => JSON.stringify(t.length > 40 ? `${t.slice(0, 39)}...` : t);
  let words = 0;
  for (const { el, text, box } of texts) {
    words += text.split(" ").length;
    let size = parseFloat(getComputedStyle(el).fontSize);
    if (el instanceof SVGElement && el.getBBox) {
      const bb = el.getBBox();
      const r = el.getBoundingClientRect();
      if (bb.height) size *= r.height / bb.height / k;
    }
    if (size < 20)
      add("error", "tiny-text", el, `${snip(text)} at ${size.toFixed(1)}px`);
    if (!el.closest("[data-bleed]")) {
      const edge = Math.min(box.l, box.t, W - box.r, H - box.b);
      if (edge < 38)
        add("error", "safe-area", el, `${snip(text)} ${Math.round(edge)}px from the edge`);
    }
    for (let p = el; p && p !== section; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const boxed =
        cs.backgroundColor !== "rgba(0, 0, 0, 0)" ||
        cs.backgroundImage !== "none" ||
        parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth) > 0;
      if (!boxed) continue;
      const b = at(p.getBoundingClientRect());
      const out = Math.max(b.l - box.l, box.r - b.r, b.t - box.t, box.b - b.b);
      if (out > 1)
        add("error", "escapes-box", el, `${snip(text)} ${Math.round(out)}px outside ${label(p)}`);
      break;
    }
  }

  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const hit = a.rects.some((x) =>
        b.rects.some((y) => {
          const w = Math.min(x.r, y.r) - Math.max(x.l, y.l);
          const h = Math.min(x.b, y.b) - Math.max(x.t, y.t);
          return w > 2 && h > 0.25 * Math.min(x.b - x.t, y.b - y.t);
        }),
      );
      if (hit) add("error", "overlap", a.el, `${snip(a.text)} overlaps ${snip(b.text)}`);
    }
  }

  for (const el of section.querySelectorAll("*")) {
    if (!shown(el) || el.closest("aside.notes, [data-lint-skip]")) continue;
    const cs = getComputedStyle(el);
    if (
      /hidden|clip|scroll|auto/.test(cs.overflowX + cs.overflowY) &&
      (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    )
      add("error", "overflow", el, `content clipped (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`);
    if (!el.closest("[data-bleed]")) {
      const b = at(el.getBoundingClientRect());
      if (b.r > b.l && (b.l < -1 || b.t < -1 || b.r > W + 1 || b.b > H + 1))
        add("error", "off-canvas", el, `extends past the ${W}x${H} slide`);
    }
  }

  if (words > 40) add("warning", "density", section, `${words} words on screen`);
  if (deck.step === 0) {
    if (!section.dataset.title && !section.querySelector("h1, h2, h3"))
      add("warning", "title", section, "no h1-h3 or data-title; controls and presenter show the id");
    if (!section.querySelector(":scope > aside.notes"))
      add("warning", "notes", section, "no <aside class=\"notes\">");
  }
  return found;
}

const browser = await puppeteer.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
let errors = 0;
let warnings = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  if (opt["no-webfonts"]) {
    await page.setRequestInterception(true);
    page.on("request", (req) =>
      req.resourceType() === "font" || /fonts\.(googleapis|gstatic)\.com/.test(req.url())
        ? req.abort()
        : req.continue(),
    );
  }
  const report = (state, level, kind, el, detail) => {
    level === "error" ? errors++ : warnings++;
    console.log(`${state.padEnd(12)} ${level.padEnd(7)} ${kind.padEnd(11)} ${el}  ${detail}`);
  };
  page.on("pageerror", (e) => report("page", "error", "exception", "", e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warn")
      report("page", m.type() === "warn" ? "warning" : "error", "console", m.location().url ?? "", m.text());
  });

  await page.goto(url, { waitUntil: "load" });
  const slides = await page.evaluate(async () => {
    await customElements.whenDefined("deck-shift");
    const deck = document.querySelector("deck-shift");
    await deck.ready;
    return deck.script();
  });

  const shots = [];
  const seen = new Set();
  for (const [i, s] of slides.entries()) {
    for (let step = 0; step <= s.steps; step++) {
      const state = `${i + 1}.${step} ${s.id}`;
      const found = await page.evaluate(
        async (i, step, lint) => {
          const deck = document.querySelector("deck-shift");
          deck.goto(i, step, { animate: false });
          await new Promise(requestAnimationFrame);
          for (const a of document.getAnimations()) {
            try {
              a.finish();
            } catch {
              a.pause();
              a.currentTime = 0;
            }
          }
          await new Promise(requestAnimationFrame);
          return new Function(`return (${lint})()`)();
        },
        i,
        step,
        lint.toString(),
      );
      for (const f of found) {
        const key = `${i} ${f.kind} ${f.el} ${f.detail}`;
        if (seen.has(key)) continue;
        seen.add(key);
        report(state, f.level, f.kind, f.el, f.detail);
      }
      if (opt.sheet)
        shots.push({
          state,
          src: `data:image/jpeg;base64,${await page.screenshot({ type: "jpeg", quality: 80, encoding: "base64" })}`,
        });
    }
  }

  if (opt.sheet) {
    const cols = Number(opt.cols);
    await page.setViewport({ width: cols * 480 + (cols + 1) * 16, height: 100 });
    await page.setContent(`<style>
      body { margin: 0; padding: 16px; background: #222; color: #ddd; font: 18px/1.3 system-ui;
        display: grid; grid-template-columns: repeat(${cols}, 480px); gap: 16px; }
      figure { margin: 0 } img { display: block; width: 480px; height: 270px; }
      figcaption { padding: 4px 0 }
    </style>${shots.map((s) => `<figure><img src="${s.src}"><figcaption>${s.state}</figcaption></figure>`).join("")}`);
    await writeFile(opt.sheet, await page.screenshot({ fullPage: true }));
    console.log(`sheet: ${opt.sheet} (${shots.length} states)`);
  }
} finally {
  await browser.close();
  server?.close();
}
console.log(`${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
