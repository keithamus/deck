---
name: deck
description: >
  Use for planning, building, checking or presenting a <deck-shift> talk:
  story, steps, transitions, charts, deck-check, presenter, recording.
---

# Deck

Reference: read `example.html` (beside this file) first. Every technique lives
there as a working slide; notes explain each. Package READMEs cover APIs:
`node_modules/<pkg>/README.md` if installed, else
`https://unpkg.com/<pkg>/README.md`, for `deck-shift`, `deck-controls`,
`deck-presenter`, `deck-recorder`, `webcam-view`, `deck-check`.

| Need                                         | Slide id                     |
| -------------------------------------------- | ---------------------------- |
| steps, `until`                               | `#markup`, `#morph`          |
| `--step-state` / `--step-on` list            | `#focus`                     |
| morph via `view-transition-name`, code       | `#markup`, `#code`           |
| SVG charts with animation `style(--step)`    | `#chart`                     |
| custom transition types                      | `#transitions`, `#presenter` |
| invoker commands, `data-no-advance`          | `#commands`                  |
| `deckchange`, `addShortcut`, per-slide style | `#script`                    |
| notes, `<mark>` cues, presenter template     | `#presenter`                 |
| recorder                                     | `#record`                    |
| reduced motion, stage, fixed `webcam-view`   | `<style>`                    |

## Plan first

Table before markup: `id | title | what each step reveals | transition + why`.
Agree, then build.

- Title = claim with verb ("Recalc dropped 40% after cache", not "Performance").
  Titles alone, in order, tell argument.
- One idea per slide, one focal point per step.
- Numbers: unit, period, source, comparison. Invented -> say illustrative.
- End on ask/takeaway. Notes written as spoken; N steps -> N `<mark>`s.

## Rules

- Look = author's call. Don't invent style unless asked.
- Every visual value from `(slide, step)` via CSS. No `setTimeout`, no
  `deckchange`-started animation final look needs. Else URL jumps, presenter
  preview, `deck-replay`, deck-check land wrong.
- Each step's rest state carries message without motion.
- Motion sequences, relates or emphasises; else cut. Settles within ~2s.
  Transition picked by how slides relate, pairing consistent.
- Text >= 20px on 1920x1080 canvas, off edges, < 40 words per step. Text boxes
  `min-height`, never fixed `height`.
- Charts: inline SVG, no chart lib. Title states answer; bars from zero; no dual
  axes; label marks, not legends.
- Every slide: `h1`-`h3` or `data-title`, and notes.

## Check

```sh
npx deck-check index.html --sheet sheet.png
npx deck-check index.html --no-webfonts
```

Project with `package.json`: `npm run build` first (deck loads `dist/`), or
`npm run check`.

Run from dir holding deck's assets. No Puppeteer Chrome ->
`PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`. Fix all errors. Open
sheet, describe, fix by state (`4.1`). Transitions: DevTools Animations at 10%.
Live pass over HTTP (not `file://`) with presenter (S) open, timed.
