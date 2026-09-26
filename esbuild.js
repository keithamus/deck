import { build as esbuild } from "esbuild";
import { minify } from "html-minifier-next";
import { readFile } from "fs/promises";
import * as path from "path";

const resolvePlugin = {
  name: "resolver",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind == "url-token")
        return {
          path: path.join(args.resolveDir, args.path),
          namespace: "resolveNS",
        };
      return null;
    });

    build.onLoad({ filter: /.*/, namespace: "resolveNS" }, async (args) => {
      const css = await readFile(args.path, "utf8");
      return { contents: css, loader: "base64" };
    });
  },
};

const cssConstructStylesheetPlugin = {
  name: "css imports",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const result = await esbuild({
        bundle: true,
        entryPoints: [args.path],
        minify: build.initialOptions.minify,
        plugins: [resolvePlugin],
        write: false,
      });
      if (args.with.type === "css") {
        const contents = `
        const styles = new CSSStyleSheet();
        styles.replaceSync(\`${result.outputFiles[0].text}\`);
        export default styles;`;
        return { contents, loader: "js" };
      } else if (args.with.type == "text") {
        const contents = `export default \`${result.outputFiles[0].text}\`;`;
        return { contents, loader: "js" };
      }
    });
  },
};

const htmlImports = {
  name: "html imports",
  setup(build) {
    build.onLoad({ filter: /\.*html$/ }, async (args) => {
      if (args.with.type === "text") {
        let result = await readFile(args.path, "utf-8");
        if (build.initialOptions.minify) {
          result = await minify(result, {
            collapseWhitespace: true,
            removeAttributeQuotes: true,
            removeOptionalTags: true,
          });
        }
        const contents = `export default \`${result}\`;`;
        return { contents, loader: "js" };
      }
    });
  },
};

export default {
  bundle: true,
  minify: true,
  format: "esm",
  plugins: [cssConstructStylesheetPlugin, htmlImports],
};
