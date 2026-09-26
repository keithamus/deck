import { build } from "esbuild";
import config from "../../esbuild.js";

await build({
  entryPoints: ["./deck-presenter.js"],
  outfile: "./deck-presenter.min.js",
  ...config,
});
