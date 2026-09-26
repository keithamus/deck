# deck-presenter

A presenter window for a [`<deck-shift>`](../deck-shift) slide deck.

```html
<script type="module" src="https://unpkg.com/deck-presenter"></script>
<deck-presenter></deck-presenter>
```

Or:

```sh
npm install deck-presenter
```

```js
import "deck-presenter";
```

Add `<deck-presenter>` anywhere on the page and press <kbd>s</kbd>, and a new
tab will open with a timer (click to reset), the position, back and next, the
clock, the current slide, and the next, with notes below.

The popup is built and run from the deck's own window, so its buttons and keys
drive the main slide deck.

### Customizing

Add a `<template>` child to the `<deck-presenter>` to inject arbitrary HTML to
the opened window, this can include CSS, scripts, or even custom elements which
will all be rendered into the opened window, allowing you to customise the
presenter view.

Scripts run in that window, with URLs relative to the deck. Module scripts run
once per window.

```html
<deck-presenter>
  <template>
    <script type="module" src="https://esm.sh/webcam-view"></script>
    <style>
      webcam-view {
        position: fixed;
        right: 24px;
        bottom: 24px;
        width: 280px;
      }
    </style>
    <webcam-view mirror></webcam-view>
  </template>
</deck-presenter>
```

The view lives in a shadow root, so style it from the template with
`::part()`:

- `header`, holding `timer`, `position`, `prev-button`, `next-button` (both
  also `button`) and `clock`.
- `main`, holding the `current-slide` frame and the `sidebar`, which holds the
  `label`, the `next-slide` frame (both frames are also `frame`), `end` (shown
  over the next frame on the last step) and `notes`.
- `cue` for each `<mark>` in the notes, plus `cue-hit` once passed or
  `cue-next` for the one the next press reaches.
- `help`, the shortcuts dialog.

```html
<deck-presenter>
  <template>
    <style>
      ::part(main) {
        grid-template-columns: 1fr 1fr;
      }
      ::part(cue-next) {
        background: hotpink;
      }
    </style>
  </template>
</deck-presenter>
```

Notes are the slide's `<aside class="notes">`, with a `<mark>` at the word where
you press for each step. It adds `--present` and S to the deck with
`addShortcut()`.
