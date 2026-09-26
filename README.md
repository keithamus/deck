# deck

Web components for giving a talk from one HTML file, with no build step. Each is
its own npm package, in `packages/`:

- [`deck-shift`](packages/deck-shift): the slide deck. Sections, steps, View
  Transitions, speaker notes.
- [`deck-controls`](packages/deck-controls): on-screen playback controls.
- [`deck-presenter`](packages/deck-presenter): the presenter window.
- [`deck-recorder`](packages/deck-recorder): records the talk (webcam, sound and
  a timed Puppeteer Replay flow) and replays it into a video.
- [`webcam-view`](packages/webcam-view): shows the webcam, or plays a video in
  its place.
- [`deck-check`](packages/deck-check): lints every slide and step of a deck in
  Chrome, and draws a contact sheet.
- [`create-deck-shift`](packages/create-deck-shift): `npm create deck-shift`
  starts a deck, optionally with esbuild and a skill for coding agents.

`example.html` shows all of them; serve the repository over HTTP and open it.
