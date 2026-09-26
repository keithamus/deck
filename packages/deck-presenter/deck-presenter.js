import CSS from "./deck-presenter.css" with { type: "text" };
import HTML from "./deck-presenter.html" with { type: "text" };

export class DeckPresenter extends HTMLElement {
  static define(tag = "deck-presenter", registry = customElements) {
    registry.define(tag, this);
  }

  #deck = null;
  #view = null;

  async connectedCallback() {
    if (this.#deck) return;
    const deck =
      this.closest("deck-shift") ??
      this.ownerDocument.querySelector("deck-shift");
    await customElements.whenDefined(deck.localName);
    this.#deck = deck;
    this.addEventListener(
      "command",
      (e) => e.command === "--present" && this.open(),
    );
    this.#deck.addShortcut(
      "--present",
      "s",
      () => this.open(),
      "Open presenter mode",
    );
  }

  open() {
    const w = open("", "deck-presenter", "popup,width=1400,height=860");
    if (!w || !this.#deck) return;
    this.#view?.abort();
    const { signal } = (this.#view = new AbortController());
    const deck = this.#deck,
      doc = w.document;
    doc.title = `Presenter: ${document.title}`;
    doc.body.replaceChildren();
    doc.body.style.margin = "0";
    const host = doc.body.appendChild(doc.createElement("div"));
    host.style.setProperty(
      "--deck-ui-accent",
      getComputedStyle(this).getPropertyValue("--deck-ui-accent"),
    );
    const extra = this.querySelector(":scope > template");
    if (extra) doc.body.append(doc.importNode(extra.content, true));
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style>` + HTML;
    const $ = (s) => root.querySelector(`[part~=${s}]`);
    const [cur, nxt] = root.querySelectorAll("iframe");
    const timer = $("timer");
    const pos = $("position");
    const clock = $("clock");
    const notes = $("notes");
    const help = $("help");

    $("prev-button").onclick = () => deck.prev();
    $("next-button").onclick = () => deck.next();
    w.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "?") return help.open ? help.close() : help.showModal();
        if (
          /^[sf]$/i.test(e.key) ||
          e.target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
        )
          return;
        const passed = new KeyboardEvent("keydown", {
          key: e.key,
          code: e.code,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          cancelable: true,
        });
        if (!dispatchEvent(passed)) e.preventDefault();
      },
      { signal },
    );

    let t0 = Date.now();
    timer.onclick = () => (t0 = Date.now());
    const two = (n) => String(n).padStart(2, "0");
    const tick = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000),
        d = new Date();
      timer.textContent = `${two(Math.floor(s / 60))}:${two(s % 60)}`;
      clock.textContent = `${two(d.getHours())}:${two(d.getMinutes())}`;
    }, 250);
    signal.addEventListener("abort", () => clearInterval(tick));

    const post = (frame, msg) =>
      frame.contentWindow?.postMessage({ deck: "goto", ...msg }, "*");
    const show = () => {
      const { slide, step, slides } = deck;
      const s = slides[slide],
        title = deck.script()[slide].title;
      const steps = deck.steps;
      const after =
        step < steps
          ? [slide, step + 1]
          : slide + 1 < slides.length
            ? [slide + 1, 0]
            : null;
      pos.textContent = `${slide + 1} / ${slides.length}${steps ? ` \u00b7 step ${step + 1} of ${steps + 1}` : ""} \u00b7 ${title}`;
      post(cur, { slide, step });
      nxt.parentElement.classList.toggle("over", !after);
      if (after) post(nxt, { slide: after[0], step: after[1], animate: false });
      const aside = s.querySelector(":scope > aside.notes");
      if (!aside)
        return void (notes.innerHTML =
          '<em class="none">No notes for this slide.</em>');
      notes.replaceChildren(...doc.importNode(aside, true).childNodes);
      notes
        .querySelectorAll("mark")
        .forEach((m, i) =>
          m.setAttribute(
            "part",
            i < step ? "cue cue-hit" : i === step ? "cue cue-next" : "cue",
          ),
        );
      notes
        .querySelector('mark[part~="cue-next"]')
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    deck.addEventListener("deckchange", show, { signal });
    for (const f of [cur, nxt]) f.addEventListener("load", show, { signal });
    w.addEventListener(
      "pagehide",
      () => this.#view.signal === signal && this.#view.abort(),
      { signal },
    );
    cur.src =
      nxt.src = `${location.href.split("#")[0]}#${deck.slide + 1}.${deck.step}`;
    show();
  }
}

if (!new URL(import.meta.url).searchParams.has("nodefine")) {
  DeckPresenter.define();
}
