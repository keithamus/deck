import { build } from "esbuild";
import config from "../../esbuild.js";

await build({
  entryPoints: ["./deck-shift.js"],
  outfile: "./deck-shift.min.js",
  ...config,
});
