# create-deck-shift

Starts a [`<deck-shift>`](../deck-shift) slide deck.

```sh
npm create deck-shift my-talk
npm create deck-shift my-talk -- --bundler --agents
```

With no options it writes `index.html`: a two slide deck that loads
`deck-shift`, [`deck-controls`](../deck-controls),
[`deck-presenter`](../deck-presenter) and [`deck-recorder`](../deck-recorder)
from unpkg, with no build step. Serve the directory over HTTP and open it.

The directory defaults to the current one. Nothing is overwritten: if any file
it would write already exists, it stops without writing.

`--bundler` loads the components from `node_modules` instead. It also writes
`main.js`, which imports them, a `.gitignore`, and a `package.json` with
[esbuild] and [`deck-check`](../deck-check), and these scripts:

| Script          | Does                                       |
| --------------- | ------------------------------------------ |
| `npm run serve` | serves the deck on <http://localhost:8000> |
| `npm run build` | bundles `main.js` to `dist/`, for hosting  |
| `npm run check` | builds, then runs `deck-check index.html`  |

`--agents` writes `.agents/skills/deck`, a skill that teaches coding agents to
plan, build and check a deck, with an `example.html` that shows every technique
as a working slide. It then prints some prompts to try.

npm passes options after `--` to the command. Without the `--` npm takes them
as its own config, and this command reads them from there, but npm warns that
this will stop working in its next major version.

[esbuild]: https://esbuild.github.io
