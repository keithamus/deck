import CSS from "./deck-recorder.css" with { type: "css" };

const two = (n) => String(n).padStart(2, "0");

const save = (blob, name) => {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: name,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
};

const KEYS = { record: "r", pause: "." };

const cssPath = (el) => {
  const root = el.getRootNode(),
    parts = [];
  for (let n = el; n; n = n.parentElement) {
    const id = n.id && `#${globalThis.CSS.escape(n.id)}`;
    if (id && root.querySelectorAll(id).length === 1) {
      parts.unshift(id);
      break;
    }
    const same = [...(n.parentElement?.children ?? [n])].filter(
      (c) => c.localName === n.localName,
    );
    parts.unshift(
      same.length > 1
        ? `${n.localName}:nth-of-type(${same.indexOf(n) + 1})`
        : n.localName,
    );
  }
  return parts.join(" > ");
};

const selector = (el) => {
  const parts = [];
  for (let n = el; n; n = n.getRootNode().host) parts.unshift(cssPath(n));
  return parts;
};

export class DeckRecorderChangeEvent extends Event {
  constructor(recording, paused) {
    super("deck-recorder-change", { bubbles: true, composed: true });
    this.recording = recording;
    this.paused = paused;
  }
}

export class DeckRecorder extends HTMLElement {
  static define(tag = "deck-recorder", registry = customElements) {
    registry.define(tag, this);
  }

  #deck;
  #run = null;
  #internals = this.attachInternals();

  shadowRoot = Object.assign(this.attachShadow({ mode: "open" }), {
    adoptedStyleSheets: [CSS],
    innerHTML: `<div class="rec" part="indicator" role="status"><i class="dot"></i><span class="time">00:00</span></div>`,
  });

  get recording() {
    return this.#run !== null;
  }

  get paused() {
    return this.#internals.states.has("paused");
  }

  async connectedCallback() {
    if (this.#deck) return;
    const deck =
      this.closest("deck-shift") ??
      this.ownerDocument.querySelector("deck-shift");
    await customElements.whenDefined(deck.localName);
    this.#deck = deck;
    deck.addShortcut(
      "--record",
      KEYS.record,
      () => this.toggle(),
      "Start / stop recording",
    );
    deck.addShortcut(
      "--record-pause",
      KEYS.pause,
      () => (this.paused ? this.resume() : this.pause()),
      "Pause / resume recording",
    );
  }

  async start() {
    this.#run ??= this.#begin().catch((e) => {
      this.#run = null;
      throw e;
    });
    await this.#run;
  }

  async pause() {
    (await this.#run)?.pause();
  }

  async resume() {
    (await this.#run)?.resume();
  }

  async stop() {
    const run = this.#run;
    if (!run) return null;
    this.#run = null;
    const { recorder, mic, done, controller, started, steps } = await run;
    if (recorder.state !== "inactive") recorder.stop();
    try {
      const { video, duration } = await done;
      const title = `recording-${started.replace(/[:.]/g, "-")}`;
      return {
        video,
        flow: {
          title,
          video: `${title}.${video.type.includes("mp4") ? "mp4" : "webm"}`,
          started,
          duration,
          slides: this.#deck.script(),
          steps,
        },
      };
    } finally {
      controller.abort();
      mic.getTracks().forEach((t) => t.stop());
      this.#state(false, false);
    }
  }

  async toggle() {
    if (!this.#run) return this.start();
    const { video, flow } = await this.stop();
    save(video, flow.video);
    save(
      new Blob([JSON.stringify(flow, null, 2)], { type: "application/json" }),
      `${flow.title}.json`,
    );
  }

  #time(ms) {
    const s = Math.floor(ms / 1000);
    this.shadowRoot.querySelector(".time").textContent =
      `${two(Math.floor(s / 60))}:${two(s % 60)}`;
  }

  #state(recording, paused) {
    const { states } = this.#internals;
    for (const [state, on] of [
      ["recording", recording],
      ["paused", paused],
    ]) {
      on ? states.add(state) : states.delete(state);
    }
    this.dispatchEvent(new DeckRecorderChangeEvent(recording, paused));
  }

  async #begin() {
    const deck = this.#deck;
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    const cam = await this.ownerDocument
      .querySelector("webcam-view")
      ?.stream?.catch((e) => {
        console.warn("deck-recorder: recording without the webcam", e);
        return null;
      });
    const recorder = new MediaRecorder(
      new MediaStream([
        ...(cam?.getVideoTracks() ?? []),
        ...mic.getAudioTracks(),
      ]),
    );
    const chunks = [],
      steps = [],
      controller = new AbortController(),
      { signal } = controller;
    let t0 = 0,
      pausedAt = null;
    const now = () => Math.round((pausedAt ?? performance.now()) - t0);
    const step = (s) => steps.push({ t: now(), ...s });

    const done = new Promise((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () =>
        resolve({
          video: new Blob(chunks, { type: recorder.mimeType }),
          duration: now(),
        });
    });
    recorder.onerror = (e) => console.error("deck-recorder:", e.error);
    await new Promise((resolve) => {
      recorder.onstart = () => {
        t0 = performance.now();
        resolve();
      };
      recorder.start(1000);
    });
    const started = new Date().toISOString();

    step({
      type: "setViewport",
      width: innerWidth,
      height: innerHeight,
      deviceScaleFactor: devicePixelRatio,
      isMobile: false,
      hasTouch: false,
      isLandscape: innerWidth >= innerHeight,
    });
    step({ type: "navigate", url: location.href });
    deck.addEventListener(
      "deckchange",
      () => step({ type: "navigate", url: location.href }),
      { signal },
    );

    let at = "";
    const where = () => `${deck.slide}.${deck.step}`;
    const before = () => (at = where());
    const moved = () => at !== where();
    const down = new Set();
    for (const type of ["keydown", "click"]) {
      addEventListener(type, before, { capture: true, signal });
    }
    addEventListener(
      "keydown",
      (e) => {
        if (
          moved() ||
          e.isComposing ||
          /^(Unidentified|Dead|Process)$/.test(e.key) ||
          (e.defaultPrevented && Object.values(KEYS).includes(e.key))
        )
          return;
        down.add(e.code);
        step({ type: "keyDown", key: e.key });
      },
      { signal },
    );
    addEventListener(
      "keyup",
      (e) => down.delete(e.code) && step({ type: "keyUp", key: e.key }),
      { signal },
    );
    addEventListener(
      "click",
      (e) => {
        const [el] = e.composedPath();
        if (moved() || !e.detail || !e.composedPath().includes(deck)) return;
        const r = el.getBoundingClientRect();
        step({
          type: "click",
          selectors: [selector(el)],
          offsetX: Math.round(e.clientX - r.left),
          offsetY: Math.round(e.clientY - r.top),
        });
      },
      { signal },
    );

    const tick = () => this.#time(now());
    tick();
    const interval = setInterval(tick, 250);
    signal.addEventListener("abort", () => clearInterval(interval));
    this.#state(true, false);

    const pause = () => {
      if (recorder.state !== "recording") return;
      recorder.pause();
      pausedAt = performance.now();
      step({ type: "customStep", name: "pause" });
      this.#state(true, true);
    };
    const resume = () => {
      if (recorder.state !== "paused") return;
      t0 += performance.now() - pausedAt;
      pausedAt = null;
      recorder.resume();
      this.#state(true, false);
    };

    return { recorder, mic, done, controller, started, steps, pause, resume };
  }
}

if (!new URL(import.meta.url).searchParams.has("nodefine")) {
  DeckRecorder.define();
}
