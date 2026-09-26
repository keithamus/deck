import CSS from "./deck-controls.css" with { type: "css" };
import HTML from "./deck-controls.html" with { type: "text" };

const IDLE = 2600;

const EDGE = 0.2;

const idle = new CSSStyleSheet();
const IDLE_RULE = "@layer deck-controls { * { cursor: none !important; } }";

const attr = (s) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const retip = (el, label, key) => {
  el.dataset.tip = `${label} (${key})`;
  el.ariaLabel = label;
};

export class DeckControls extends HTMLElement {
  static define(tag = "deck-controls", registry = customElements) {
    registry.define(tag, this);
  }

  #hover = false;
  #shown = 0;
  #idle = 0;

  #internals = this.attachInternals();

  shadowRoot = Object.assign(
    this.attachShadow({ mode: "open", slotAssignment: "manual" }),
    {
      adoptedStyleSheets: [CSS],
      innerHTML: HTML,
    },
  );

  get #deck() {
    return (
      this.closest("deck-shift") ??
      this.ownerDocument.querySelector("deck-shift")
    );
  }

  get #script() {
    return this.#deck?.script();
  }

  get #bar() {
    return this.shadowRoot.querySelector("[part=bar]");
  }

  get #presenterButton() {
    return this.shadowRoot.querySelector('[command="--present"]');
  }

  get #fullscreenButton() {
    return this.shadowRoot.querySelector('[command="--fullscreen"]');
  }

  get #recordButton() {
    return this.shadowRoot.querySelector('[command="--record"]');
  }

  get #pauseButton() {
    return this.shadowRoot.querySelector('[command="--record-pause"]');
  }

  get #scrub() {
    return this.shadowRoot.querySelector(".scrub");
  }

  async connectedCallback() {
    const deck = this.#deck;
    await customElements.whenDefined(deck.localName);
    this.#scrub.innerHTML = this.#script
      .map(
        (s, i) =>
          `<button class="seg" command="--goto:${i + 1}" data-tip="${i + 1}. ${attr(s.title)}" aria-label="Slide ${i + 1}: ${attr(s.title)}"><i></i></button>`,
      )
      .join("");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, idle];

    for (const b of this.shadowRoot.querySelectorAll('[command^="--"]')) {
      b.commandForElement = deck;
    }

    const commands = () => {
      this.#presenterButton.hidden = !deck.commands.includes("--present");
      this.#recordButton.hidden = !deck.commands.includes("--record");
    };
    commands();
    deck.addEventListener("deck-shift-shortcut-add", commands);

    document.addEventListener(
      "deck-recorder-change",
      ({ recording, paused }) => {
        this.#internals.states[recording ? "add" : "delete"]("recording");
        this.#internals.states[paused ? "add" : "delete"]("recording-paused");
        retip(this.#recordButton, recording ? "Stop recording" : "Record", "R");
        retip(
          this.#pauseButton,
          paused ? "Resume recording" : "Pause recording",
          ".",
        );
      },
    );

    document.addEventListener("fullscreenchange", () => {
      const cmd = document.fullscreenElement ? "add" : "delete";
      this.#internals.states[cmd]("fullscreen");
    });

    const bar = this.#bar;
    bar.addEventListener("mouseenter", () => {
      this.#hover = true;
      this.#show();
    });
    bar.addEventListener("mouseleave", () => {
      this.#hover = false;
      this.#show();
    });

    addEventListener("touchstart", () => this.#show(), { passive: true });

    addEventListener("mousemove", (e) => {
      if (!e.movementX && !e.movementY) return;
      this.#internals.states.delete("idle");
      idle.replaceSync("");
      clearTimeout(this.#idle);
      this.#idle = setTimeout(() => {
        this.#internals.states.add("idle");
        idle.replaceSync(IDLE_RULE);
      }, IDLE);
      this.#show();
      const x = e.clientX / innerWidth;
      const inBar = e.composedPath().includes(bar);
      const left = !inBar && x < EDGE ? "add" : "delete";
      const right = !inBar && x > 1 - EDGE ? "add" : "delete";
      this.#internals.states[left]("edge-l");
      this.#internals.states[right]("edge-r");
    });
    document.addEventListener("mouseleave", () =>
      this.#internals.states.delete("edge-l").delete("edge-r"),
    );

    deck.addEventListener("deckchange", () => this.#update());
    this.#update();
  }

  #show(ms = IDLE) {
    this.#internals.states.add("on");
    clearTimeout(this.#shown);
    this.#shown = setTimeout(
      () => !this.#hover && this.#internals.states.delete("on"),
      ms,
    );
  }

  #update() {
    const { slide, step } = this.#deck,
      s = this.#script[slide];
    this.shadowRoot.querySelectorAll(".seg i").forEach((fill, k) => {
      fill.style.scale = `${k < slide ? 1 : k > slide ? 0 : (step + 1) / (s.steps + 1)} 1`;
    });
  }
}

if (!new URL(import.meta.url).searchParams.has("nodefine")) {
  DeckControls.define();
}
