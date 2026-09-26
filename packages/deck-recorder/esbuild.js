import { build } from "esbuild";
import config from "../../esbuild.js";

await build({
  entryPoints: ["./deck-recorder.js"],
  outfile: "./deck-recorder.min.js",
  ...config,
});
