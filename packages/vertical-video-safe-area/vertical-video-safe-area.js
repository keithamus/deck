import PAGE from "./page.css" with { type: "css" };
import CSS from "./vertical-video-safe-area.css" with { type: "css" };
import HTML from "./vertical-video-safe-area.html" with { type: "text" };

export class VerticalVideoSafeArea extends HTMLElement {
  static define(tag = "vertical-video-safe-area", registry = customElements) {
    registry.define(tag, this);
  }

  shadowRoot = Object.assign(this.attachShadow({ mode: "open" }), {
    adoptedStyleSheets: [CSS],
    innerHTML: HTML,
  });

  connectedCallback() {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, PAGE];
    console.log(PAGE);
  }
}

if (!new URL(import.meta.url).searchParams.has("nodefine")) {
  VerticalVideoSafeArea.define();
}
