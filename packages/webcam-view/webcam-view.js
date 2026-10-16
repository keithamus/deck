import CSS from "./webcam-view.css" with { type: "css" };

const VERTEX = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2(gl_VertexID & 1, gl_VertexID >> 1) * 2.0;
  uv = vec2(p.x, 1.0 - p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D frame;
uniform vec3 key;
uniform vec4 settings;
in vec2 uv;
out vec4 color;

vec2 chroma(vec3 rgb) {
  return vec2(
    dot(rgb, vec3(-0.100644, -0.338572, 0.439216)),
    dot(rgb, vec3(0.439216, -0.398942, -0.040274))
  );
}

const vec2 ring[8] = vec2[8](
  vec2(1.0, 0.0), vec2(0.7071, 0.7071), vec2(0.0, 1.0), vec2(-0.7071, 0.7071),
  vec2(-1.0, 0.0), vec2(-0.7071, -0.7071), vec2(0.0, -1.0), vec2(0.7071, -0.7071)
);

float dist(vec2 at) {
  return distance(chroma(texture(frame, at).rgb), chroma(key)) /
    max(length(chroma(key)), 0.001) - settings.x;
}

float matte(float d) {
  return pow(clamp(d / settings.y, 0.0, 1.0), 1.5);
}

void main() {
  vec2 px = 1.0 / vec2(textureSize(frame, 0));
  vec2 a = vec2(px.x, px.y / 2.0);
  vec2 b = vec2(px.x / 2.0, -px.y);
  float d = ((dist(uv - a) + dist(uv + a) + dist(uv - b) + dist(uv + b)) * 2.0 + dist(uv)) / 9.0;
  float alpha = matte(d);
  if (settings.w > 0.0) {
    for (int i = 0; i < 8; i++) alpha += matte(dist(uv + ring[i] * px * settings.w));
    alpha /= 9.0;
  }
  vec3 rgb = texture(frame, uv).rgb;
  float spill = pow(clamp(d / settings.z, 0.0, 1.0), 1.5);
  rgb = mix(vec3(dot(rgb, vec3(0.2126, 0.7152, 0.0722))), rgb, spill);
  color = vec4(rgb, 1.0) * alpha;
}`;

let probe;

function rgb(color) {
  probe ??= new OffscreenCanvas(1, 1).getContext("2d", {
    willReadFrequently: true,
  });
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "transparent";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return a ? [r / 255, g / 255, b / 255] : null;
}

function play(video) {
  video.play().catch((e) => {
    if (e.name !== "AbortError") throw e;
  });
}

export class WebcamView extends HTMLElement {
  static define(tag = "webcam-view", registry = customElements) {
    registry.define(tag, this);
  }

  #stream = null;
  #src = null;
  #style = getComputedStyle(this);
  #frame = 0;
  #keyText = "";
  #key = null;
  #tainted = false;
  #gl;
  #uniforms;

  shadowRoot = Object.assign(this.attachShadow({ mode: "open" }), {
    adoptedStyleSheets: [CSS],
    innerHTML: `<video part="video" muted playsinline></video><canvas part="video" hidden></canvas>`,
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
    this.#frame = requestAnimationFrame(this.#draw);
    this.#tainted = false;
    const video = this.video;
    if (this.#src) {
      video.muted = false;
      video.src = this.#src;
      play(video);
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
          play(video);
          return stream;
        }) ?? Promise.resolve();
    pending.catch(() => {});
    this.#stream = pending;
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#frame);
    const video = this.video;
    video.srcObject?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    if (video.hasAttribute("src")) {
      video.removeAttribute("src");
      video.load();
    }
    this.#stream = null;
  }

  #draw = () => {
    this.#frame = requestAnimationFrame(this.#draw);
    const video = this.video;
    const canvas = this.shadowRoot.querySelector("canvas");
    const text = this.#style.getPropertyValue("--chromakey").trim();
    if (text !== this.#keyText) {
      this.#keyText = text;
      this.#key = text ? rgb(text) : null;
    }
    const gl = this.#key && !this.#tainted && this.#context(canvas);
    if (video.hidden !== !!gl) {
      video.hidden = !!gl;
      canvas.hidden = !gl;
    }
    if (!gl || video.readyState < video.HAVE_CURRENT_DATA) return;
    const { videoWidth: width, videoHeight: height } = video;
    if (canvas.width !== width || canvas.height !== height) {
      Object.assign(canvas, { width, height });
      gl.viewport(0, 0, width, height);
    }
    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        video,
      );
    } catch (e) {
      if (e.name !== "SecurityError") throw e;
      console.warn(
        "webcam-view: not keying a cross-origin video without CORS",
        e,
      );
      this.#tainted = true;
      return;
    }
    gl.uniform3fv(this.#uniforms.key, this.#key);
    gl.uniform4f(
      this.#uniforms.settings,
      this.#number("--chromakey-similarity", 0.75),
      this.#number("--chromakey-smoothness", 0.15),
      this.#number("--chromakey-spill", 0.2),
      this.#number("--chromakey-feather", 0),
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  #number(name, fallback) {
    const value = parseFloat(this.#style.getPropertyValue(name));
    return value >= 0 ? value : fallback;
  }

  #context(canvas) {
    if (this.#gl === undefined) {
      const gl = (this.#gl = canvas.getContext("webgl2", {
        antialias: false,
        depth: false,
      }));
      if (gl) {
        const program = gl.createProgram();
        for (const [type, source] of [
          [gl.VERTEX_SHADER, VERTEX],
          [gl.FRAGMENT_SHADER, FRAGMENT],
        ]) {
          const shader = gl.createShader(type);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        gl.useProgram(program);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.#uniforms = {
          key: gl.getUniformLocation(program, "key"),
          settings: gl.getUniformLocation(program, "settings"),
        };
      }
    }
    return this.#gl?.isContextLost() ? null : this.#gl;
  }
}

if (!new URL(import.meta.url).searchParams.has("nodefine")) {
  WebcamView.define();
}
