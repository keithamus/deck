import { build } from "esbuild";
import config from "../../esbuild.js";

await build({
  entryPoints: ["./vertical-video-safe-area.js"],
  outfile: "./vertical-video-safe-area.min.js",
  ...config,
});
