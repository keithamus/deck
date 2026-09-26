# deck-check

Lints every slide and step of a [`<deck-shift>`](../deck-shift) deck in Chrome,
and draws a contact sheet of them all.

```sh
npm install --save-dev deck-check
npx deck-check talk.html [--sheet sheet.png] [--cols 4] [--no-webfonts]
```

A file path is served over HTTP from the current directory, so run it from a
directory that holds everything the deck loads. A URL is opened as is.

Every step is shown with `goto(slide, step, { animate: false })`, its CSS
transitions and animations finished (infinite ones are paused at their start),
and then checked at 1920x1080:

| Finding       | Level   | Meaning                                                             |
| ------------- | ------- | ------------------------------------------------------------------- |
| `tiny-text`   | error   | text under 20px on the slide canvas (SVG text after its scaling)    |
| `safe-area`   | error   | text within 38px of the slide edge                                  |
| `escapes-box` | error   | text outside the nearest box it sits in with a background or border |
| `overlap`     | error   | text from two elements overlapping                                  |
| `overflow`    | error   | an element with `overflow` other than visible clipping its content  |
| `off-canvas`  | error   | an element reaching past the slide edge                             |
| `density`     | warning | over 40 words on screen                                             |
| `title`       | warning | a slide without an `h1`-`h3` or `data-title`                        |
| `notes`       | warning | a slide without `<aside class="notes">`                             |
| `exception`   | error   | an uncaught error in the page                                       |
| `console`     | varies  | a console error or warning, such as mismatched `<mark>` cues        |

Each finding is reported once per slide, at the first step it shows. Anything
inside `[data-bleed]` may touch or cross the edge; anything inside
`[data-lint-skip]` (a code sample, text that is really an illustration) is not
checked. The exit code is 1 if there are any errors.

`--sheet` writes a PNG with every step, labelled `slide.step id`, `--cols`
wide. `--no-webfonts` blocks font requests, to check the deck still fits with
fallback fonts.

It launches Chrome with [Puppeteer]; set `PUPPETEER_EXECUTABLE_PATH` to use an
installed Chrome instead of the one Puppeteer downloads.

[Puppeteer]: https://pptr.dev
