import CSS from "./webcam-view.css" with { type: "css" };

export class WebcamView extends HTMLElement {
  static define(tag = "webcam-view", registry = customElements) {
    registry.define(tag, this);
  }

  #stream = null;
  #src = null;

  shadowRoot = Object.assign(this.attachShadow({ mode: "open" }), {
    adoptedStyleSheets: [CSS],
    innerHTML: `<video part="video" autoplay muted playsinline></video>`,
  });

  get stream() {
    return this.#stream;
  }

  get src() {
    return this.#src;
  }

  set src(url) {
    this.#src = url || null;
    if (!this.isConnected) return;
    this.disconnectedCallback();
    this.connectedCallback();
  }

  get video() {
    return this.shadowRoot.querySelector("video");
  }

  connectedCallback() {
    const video = this.video;
    if (this.#src) {
      video.muted = false;
      video.src = this.#src;
      return;
    }
    video.muted = true;
    const pending =
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 1280, height: 720 } })
        .then((stream) => {
          if (this.#stream !== pending) {
            stream.getTracks().forEach((t) => t.stop());
            throw new DOMException("disconnected", "AbortError");
          }
          video.srcObject = stream;
          return stream;
        }) ?? Promise.resolve();
    pending.catch(() => {});
    this.#stream = pending;
  }

  disconnectedCallback() {
    const video = this.video;
    video.srcObject?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    if (video.hasAttribute("src")) {
      video.removeAttribute("src");
      video.load();
    }
    this.#stream = null;
  }
}

if (!new URL(import.meta.url).searchParams.has("nodefine")) {
  WebcamView.define();
}
