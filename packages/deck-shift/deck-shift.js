import STAGE from "./deck-shift.css" with { type: "css" };
import HTML from "./deck-shift.html" with { type: "text" };
import PAGE from "./page.css" with { type: "css" };

const ROW = (() => {
  let template = document.createElement("template");
  template.innerHTML = `<tr><td><kbd></kbd></td><td></td></tr>`;
  return template.content.cloneNode(true);
})();

const EDGE = 0.2;

const KEYS = {
  ArrowRight: "next",
  " ": "next",
  PageDown: "next",
  n: "next",
  ArrowLeft: "prev",
  PageUp: "prev",
  p: "prev",
  f: "fullscreen",
  ArrowDown: "nextSlide",
  ArrowUp: "prevSlide",
  Home: "first",
  End: "last",
  "?": "help",
};

const COMMANDS = {
  "--next": "next",
  "--prev": "prev",
  "--next-slide": "nextSlide",
  "--prev-slide": "prevSlide",
  "--first": "first",
  "--last": "last",
  "--fullscreen": "fullscreen",
  "--help": "help",
};

const PAGE_STATE = new CSSStyleSheet();
const PAGE_STATE_BY_ID = {};

const id = () => Math.floor(Math.random() * 1e10).toString(16);

const cues = (section) => {
  const aside = section.querySelector(":scope > aside.notes");
  if (!aside) return [];
  const at = (m) => [m.parentNode, [...m.parentNode.childNodes].indexOf(m)];
  const points = [
    [aside, 0],
    ...[...aside.querySelectorAll("mark")].map(at),
    [aside, aside.childNodes.length],
  ];
  return points.slice(1).map((end, i) => {
    const r = new Range();
    r.setStart(...points[i]);
    r.setEnd(...end);
    return r.toString().replace(/\s+/g, " ").trim();
  });
};

const range = (el) => {
  const a =
    el.getAttribute("step").trim() === "" ? 1 : Number(el.getAttribute("step"));
  const b = el.hasAttribute("until")
    ? Number(el.getAttribute("until"))
    : Infinity;
  return [a, b];
};

const quote = (s) => `"${s.replace(/["\\]/g, "\\$&")}"`;

export class DeckShortcutAddEvent extends Event {
  constructor(name, key, description) {
    super("deck-shift-shortcut-add");
    this.name = name;
    this.key = key;
    this.description = description;
  }
}

export class DeckChangeEvent extends Event {
  constructor(slide, step, id, steps, count) {
    super("deckchange");
    this.slide = slide;
    this.step = step;
    this.id = id;
    this.steps = steps;
    this.count = count;
  }
}

export class DeckShift extends HTMLElement {
  static define(tag = "deck-shift", registry = customElements) {
    registry.define(tag, this);
  }

  #internals = this.attachInternals();
  #deckid = `deck-${id()}`;
  #slide = 0;
  #step = 0;
  #state = new CSSStyleSheet();
  #swiped = 0;
  #touch = null;
  #abortController = null;

  shadowRoot = Object.assign(
    this.attachShadow({ mode: "open", slotAssignment: "manual" }),
    {
      adoptedStyleSheets: [STAGE, this.#state],
      innerHTML: HTML,
    },
  );

  get #slot() {
    return this.shadowRoot.querySelector("slot");
  }

  get #help() {
    return this.shadowRoot.querySelector("dialog");
  }

  get slides() {
    return [...this.querySelectorAll(":scope > section")];
  }
  get slide() {
    return this.#slide;
  }
  get step() {
    return this.#step;
  }

  get steps() {
    return this.#stepsOf(this.#slide);
  }

  connectedCallback() {
    this.#abortController?.abort();
    const { signal } = (this.#abortController = new AbortController());
    this.slides.forEach((s, i) => {
      const n = cues(s).length,
        steps = this.#stepsOf(i);
      if (n && n !== steps + 1)
        console.warn(
          `slide ${this.#id(i)}: ${n - 1} <mark> cues for ${steps} steps`,
        );
    });
    document.adoptedStyleSheets = [
      ...document.adoptedStyleSheets,
      PAGE,
      PAGE_STATE,
    ];
    [this.#slide, this.#step] = this.#fromHash();
    this.#render();
    this.#internals.states.add(this.#deckid);

    this.addEventListener("command", (e) => this.#onCommand(e));
    this.addEventListener("click", (e) => this.#onClick(e));
    this.addEventListener(
      "touchstart",
      (e) => (this.#touch = [e.touches[0].clientX, e.touches[0].clientY]),
      { passive: true },
    );
    this.addEventListener("touchend", (e) => this.#onTouchEnd(e));
    addEventListener("message", (e) => this.#onMessage(e), { signal });
    addEventListener("keydown", (e) => this.#onKey(e), { signal });
    addEventListener("hashchange", () => this.goto(...this.#fromHash()), {
      signal,
    });
  }

  disconnectedCallback() {
    this.#abortController?.abort();
  }

  script() {
    return this.slides.map((s, i) => ({
      id: this.#id(i),
      title:
        s.dataset.title ??
        s.querySelector("h1, h2, h3")?.textContent.trim() ??
        this.#id(i),
      steps: this.#stepsOf(i),
      cues: cues(s),
    }));
  }

  #onClick(e) {
    if (Date.now() - this.#swiped < 500) return;
    if (
      e.target.closest(
        "a, button, input, select, textarea, label, summary, [data-no-advance]",
      )
    )
      return;
    e.clientX < innerWidth * EDGE ? this.prev() : this.next();
  }

  #onTouchEnd(e) {
    if (!this.#touch) return;
    const [tx, ty] = this.#touch;
    const dx = e.changedTouches[0].clientX - tx,
      dy = e.changedTouches[0].clientY - ty;
    this.#touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      this.#swiped = Date.now();
      dx < 0 ? this.next() : this.prev();
    }
  }

  goto(slide, step = 0, { animate = true } = {}) {
    const i = this.#find(slide);
    if (i < 0) return;
    const k = Math.max(0, Math.min(step, this.#stepsOf(i)));
    if (i === this.#slide && k === this.#step) return;
    const kind =
      i === this.#slide
        ? "step"
        : (this.slides[i].dataset.transition ??
          this.dataset.transition ??
          "fade");
    const direction =
      i > this.#slide || (i === this.#slide && k > this.#step)
        ? "forward"
        : "back";
    this.#slide = i;
    this.#step = k;
    if (!animate || kind === "none" || !document.startViewTransition)
      return void this.#render();
    return document.startViewTransition({
      update: () => this.#render(),
      types: [kind, direction],
    });
  }

  next() {
    return this.#step < this.steps
      ? this.goto(this.#slide, this.#step + 1)
      : this.goto(this.#slide + 1, 0);
  }

  prev() {
    return this.#step > 0
      ? this.goto(this.#slide, this.#step - 1)
      : this.goto(this.#slide - 1, this.#stepsOf(this.#slide - 1));
  }

  nextSlide() {
    return this.goto(this.#slide + 1, 0);
  }

  prevSlide() {
    return this.goto(this.#slide - 1, 0);
  }

  first() {
    return this.goto(0, 0);
  }

  last() {
    return this.goto(
      this.slides.length - 1,
      this.#stepsOf(this.slides.length - 1),
    );
  }

  fullscreen() {
    return document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
  }

  help() {
    this.#help.open ? this.#help.close() : this.#help.showModal();
  }

  get commands() {
    return Object.keys(COMMANDS);
  }

  addShortcut(name, key, callback, description = "") {
    const body = this.#help.querySelector("tbody");
    const row = ROW.cloneNode(true);
    row.querySelector("kbd").textContent = key;
    row.querySelector("td:last-child").textContent = description;
    COMMANDS[name] = callback;
    KEYS[key] = callback;
    body.append(row);
    this.dispatchEvent(new DeckShortcutAddEvent(name, key, description));
  }

  #id(i) {
    return this.slides[i].id || String(i + 1);
  }

  #stepsOf(i) {
    const s = this.slides[i];
    if (!s) return 0;
    let last = 0;
    for (const el of s.querySelectorAll("[step]")) {
      const [a, b] = range(el);
      last = Math.max(last, a || 0, Number.isFinite(b) ? b : 0);
    }
    return last;
  }

  #find(slide) {
    if (typeof slide === "number")
      return slide >= 0 && slide < this.slides.length ? slide : -1;
    const i = this.slides.findIndex((s) => s.id === slide);
    if (i >= 0 || !/^\d+$/.test(slide)) return i;
    return +slide >= 1 && +slide <= this.slides.length ? +slide - 1 : -1;
  }

  #fromHash() {
    const [id, step] = decodeURIComponent(location.hash.slice(1)).split(".");
    const i = Math.max(0, this.#find(id || "1"));
    return [i, Math.min(+step || 0, this.#stepsOf(i))];
  }

  #render() {
    const k = this.#step,
      s = this.slides[this.#slide];
    this.#slot.assign(s);
    const future = new Set(),
      past = new Set();
    for (const el of s.querySelectorAll("[step]")) {
      const [a, b] = range(el);
      if (k < a) future.add(`[step=${quote(el.getAttribute("step"))}]`);
      else if (k > b) past.add(`[until=${quote(el.getAttribute("until"))}]`);
    }
    const hide = (set, state) =>
      set.size
        ? `${[...set].join(", ")}{` +
          `visibility:hidden;` +
          `--deck-step-state:${state};` +
          `--deck-step-on:0;` +
          `}`
        : "";
    this.#state.replaceSync(
      ":host{" +
        `--deck-slide-count:${this.slides.length};` +
        `--deck-step-count:${this.steps};` +
        `--deck-current-slide:${this.#slide + 1};` +
        `--deck-current-step:${k};` +
        "}",
    );

    PAGE_STATE_BY_ID[this.#deckid] =
      `&>section:nth-child(${this.#slide + 1}) {` +
      `--deck-slide-state:active;` +
      `[step]{` +
      `--deck-step-state:active;` +
      `--deck-step-on:1;` +
      `}` +
      hide(past, "past") +
      hide(future, "future") +
      "}";

    PAGE_STATE.replaceSync(
      Object.entries(PAGE_STATE_BY_ID)
        .map(([k, v]) => `deck-shift:state(${k}){${v}}`)
        .join("\n"),
    );

    history.replaceState(
      null,
      "",
      `#${this.#id(this.#slide)}${k ? `.${k}` : ""}`,
    );
    this.dispatchEvent(
      new DeckChangeEvent(
        this.#slide,
        k,
        this.#id(this.#slide),
        this.steps,
        this.slides.length,
      ),
    );
  }

  #onKey(e) {
    if (
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.target.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
    ) {
      return;
    }
    const action = KEYS[e.key];
    if (typeof action == "string") {
      e.preventDefault();
      this[action]();
    } else if (typeof action === "function") {
      e.preventDefault();
      action();
    }
  }

  #onCommand(e) {
    const [, target] = /^--goto:(.+)$/.exec(e.command) ?? [];
    let command = COMMANDS[e.command];
    if (target) {
      const [slide, step] = target.split(".");
      this.goto(slide, +step || 0);
    } else if (typeof command == "string") {
      this[command]();
    } else if (typeof command == "function") {
      command();
    }
  }

  #onMessage({ data }) {
    if (data?.deck === "goto") {
      this.goto(data.slide, data.step, { animate: data.animate ?? true });
    } else if (typeof this[data?.deck] == "function") {
      this[data.deck]();
    } else if (typeof COMMANDS[data?.deck] === "function") {
      const command = COMMANDS[data?.deck];
      command();
    }
  }
}

if (!new URL(import.meta.url).searchParams.has("nodefine")) {
  DeckShift.define();
}
