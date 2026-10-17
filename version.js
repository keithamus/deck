import { globSync, readFileSync, writeFileSync } from "node:fs";

const FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const version = process.argv[2]?.replace(/^v/, "");
if (!version) {
  console.error("Usage: node version.js <version>");
  process.exit(1);
}

const { workspaces } = JSON.parse(readFileSync("package.json", "utf8"));
const manifests = workspaces
  .flatMap((pattern) => globSync(`${pattern}/package.json`))
  .map((file) => [file, JSON.parse(readFileSync(file, "utf8"))]);
const names = new Set(manifests.map(([, manifest]) => manifest.name));

for (const [file, manifest] of manifests) {
  manifest.version = version;
  for (const field of FIELDS) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      if (names.has(name)) manifest[field][name] = `^${version}`;
    }
  }
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${manifest.name}@${version}`);
}
