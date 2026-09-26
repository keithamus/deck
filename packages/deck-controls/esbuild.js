import { build } from "esbuild";
import config from "../../esbuild.js";

await build({
  entryPoints: ["./deck-controls.js"],
  outfile: "./deck-controls.min.js",
  ...config,
});
