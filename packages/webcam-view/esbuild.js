import { build } from "esbuild";
import config from "../../esbuild.js";

await build({
  entryPoints: ["./webcam-view.js"],
  outfile: "./webcam-view.min.js",
  ...config,
});
