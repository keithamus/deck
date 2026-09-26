#!/usr/bin/env node
import { cp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

const USAGE = `Usage: npm create deck-shift [dir] -- [--bundler] [--agents]

Writes index.html, a starter <deck-shift> deck, into dir (default: here).

  --bundler  also write package.json (esbuild, the components, deck-check),
             main.js and .gitignore, with build, serve and check scripts
  --agents   also write .agents/skills/deck, a skill for coding agents
  -h, --help show this help`;

const COMPONENTS = [
  "deck-shift",
  "deck-controls",
  "deck-presenter",
  "deck-recorder",
];

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      bundler: { type: "boolean" },
      agents: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
} catch (error) {
  console.error(`${error.message}\n\n${USAGE}`);
  process.exit(1);
}
if (args.values.help) {
  console.log(USAGE);
  process.exit(0);
}
if (args.positionals.length > 1) {
  console.error(`Expected at most one directory.\n\n${USAGE}`);
  process.exit(1);
}

const flag = (name) =>
  args.values[name] ?? process.env[`npm_config_${name}`] === "true";
const bundler = flag("bundler");
const agents = flag("agents");

const dir = resolve(args.positionals[0] ?? ".");
const name = basename(dir);
const packageName =
  name
    .toLowerCase()
    .replace(/[^a-z0-9._~-]+/g, "-")
    .replace(/^[._-]+|-+$/g, "") || "deck";

const scripts = bundler
  ? `    <script type="module" src="dist/main.js"></script>`
  : COMPONENTS.map(
      (pkg) =>
        `    <script type="module" src="https://unpkg.com/${pkg}"></script>`,
    ).join("\n");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(name)}</title>
${scripts}
    <style>
      deck-shift {
        font: 56px/1.3 system-ui, sans-serif;
      }
      section {
        padding: 120px 160px;
        background: white;
      }
    </style>
  </head>
  <body>
    <deck-shift>
      <section id="title">
        <h1>${escapeHtml(name)}</h1>
        <p>Press <kbd>S</kbd> for the presenter view.</p>
        <aside class="notes">Speaker notes go here, in the presenter view.</aside>
      </section>

      <section id="steps">
        <h2>Steps</h2>
        <ul>
          <li step="1">Shown on the first press</li>
          <li step="2">Shown on the second</li>
        </ul>
        <aside class="notes">
          Each <mark>mark</mark> is a press; <mark>this</mark> one is step 2.
        </aside>
      </section>
    </deck-shift>
    <deck-controls></deck-controls>
    <deck-presenter></deck-presenter>
    <deck-recorder></deck-recorder>
  </body>
</html>
`;

const files = new Map([["index.html", html]]);

if (bundler) {
  const pkg = {
    name: packageName,
    private: true,
    type: "module",
    scripts: {
      build: "esbuild main.js --bundle --minify --format=esm --outdir=dist",
      serve: "esbuild main.js --bundle --format=esm --outdir=dist --servedir=.",
      check: "npm run build && deck-check index.html",
    },
    dependencies: Object.fromEntries(COMPONENTS.map((pkg) => [pkg, "^0.1.0"])),
    devDependencies: {
      "deck-check": "^0.1.0",
      esbuild: "^0.28.2",
    },
  };
  files.set("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  files.set("main.js", COMPONENTS.map((pkg) => `import "${pkg}";\n`).join(""));
  files.set(".gitignore", "node_modules/\ndist/\n");
}

const skillSource = new URL("template/agents/skills/deck/", import.meta.url);
const skillTarget = join(".agents", "skills", "deck");
const targets = [...files.keys(), ...(agents ? [skillTarget] : [])];

const clashes = targets.filter((file) => existsSync(join(dir, file)));
if (clashes.length) {
  console.error(`Not overwriting, these already exist in ${dir}:`);
  for (const file of clashes) console.error(`  ${file}`);
  process.exit(1);
}

await mkdir(dir, { recursive: true });
for (const [file, content] of files) await writeFile(join(dir, file), content);
if (agents) await cp(skillSource, join(dir, skillTarget), { recursive: true });

const where = relative(process.cwd(), dir);
const lines = [
  `Created a deck-shift deck in ${where || "this directory"}:`,
  "",
];
lines.push("  index.html      the deck: each <section> is a slide");
if (bundler) {
  lines.push(
    "  main.js         imports the components; esbuild bundles it to dist/",
  );
  lines.push(
    "  package.json    the components, esbuild and deck-check, with scripts",
  );
  lines.push("  .gitignore      ignores node_modules/ and dist/");
}
if (agents) {
  lines.push("  .agents/skills/deck/");
  lines.push(
    "                  a skill for coding agents, with example.html showing",
  );
  lines.push("                  every technique as a working slide");
}

lines.push("", "Next:", "");
if (where)
  lines.push(
    `  cd ${/^[\w./-]+$/.test(where) ? where : JSON.stringify(where)}`,
  );
if (bundler) {
  lines.push("  npm install");
  lines.push(
    "  npm run serve   serve it on http://localhost:8000, rebuilt on every load",
  );
  lines.push("  npm run build   bundle to dist/ for hosting");
  lines.push("  npm run check   lint every slide and step in Chrome");
} else {
  lines.push("  npx serve       or any static server, then open index.html");
  lines.push("  npx deck-check index.html");
  lines.push("                  lint every slide and step in Chrome");
}
lines.push("", "Keys: arrows to move, S for the presenter, R to record.");

if (agents) {
  lines.push(
    "",
    "Try asking your agent:",
    "",
    '  "Plan a 20 minute talk on <topic>. Give me the slide table first."',
    '  "Turn these notes into slides, one idea per slide: <paste notes>"',
    '  "Add a bar chart of <data> that builds one bar per step."',
    '  "Write speaker notes for every slide, with a <mark> for each step."',
    '  "Run deck-check, fix every error, then describe the contact sheet."',
  );
}

console.log(lines.join("\n"));

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}
