# deck-shift

deck-shift lets you build a slide deck in a single HTML file, with no build
step, no stylesheet, and a tiny bit of JS. `<deck-shift>` brings just enough
CSS to be functional, and turns every slide and step change into a same-document
View Transition, meaning you can define the look and feel with the tools and
techniques you know.

## Usage

You can drop in the script, add the element, and write each child `<section>`
which becomes a slide. `<aside class="notes">` are hidden:

```html
<script type="module" src="https://unpkg.com/deck-shift"></script>
<deck-shift>
  <section id="intro">
    <h2>Hello</h2>
    <p step="1">Shown on the first press</p>
    <aside class="notes">Say this, <mark>then</mark> press on "then".</aside>
  </section>
</deck-shift>
```

### Install and bundle

```sh
npm install deck-shift
```

```js
import "deck-shift";
```

## Slides and steps

- Each `<section>` in `<deck-shift>` is a slide. The URL hash will change to the
  slide number for each transition (so e.g. `#1`, `#2` and so on). If the
  `<section>` has an ID then that's used (e.g. `#intro`).
- Each `step=` attribute inside a section marks an intra-slide transition, so
  the for example `step=3` holds an element back until step 3 (an empty `step`
  means 1). `step="0" until="1"` is shown on arrival and gone at step 2. A
  slide has as many steps as its highest number. These are also URL navigable:
  `#intro.1` is the intro slide, step 1.
- Out-of-range `[step]` elements are `visibility: hidden`, in a cascade layer,
  so any style of yours overrides it.
- The built-in CSS keeps slides laid out at 1920x1080 and scaled to fit the
  window, but you can override all of this with the custom properties, parts,
  and states:
  - `deck-shift::part(stage)` can be used to select the stage area.
  - `--deck-width` and `--deck-height` determine the dimensions.
  - `--deck-backdrop` is the surrounding background color.
  - `--deck-current-slide` is the current 1-indexed slide number,
  - `--deck-current-step` is the current 1-indexed step number,
  - `--deck-slide-count` is the total number of slides
  - `--deck-slide-state` will be either `active`, `past`, or `future`.
  - `--deck-step-state` will be either `active`, `past`, or `future`.
  - `--deck-step-on` will be either `0` (this isn't a step, or its off) or
    `1` (this step is active). This is similar to `--deck-step-state` but useful
    for multiplication.

These allow you to write selectors like:

```css
@container style(--slide: 2) { ... }`

@container style(--step-state: active) { .ring::after { ... } }

@container style(--deck-step: 2) or style(--step: 3) {
  [step][until=1] { ... }
}

[step] {
  outline-color: rgb(from red r g b / var(--step-on));
}
```

## Transitions

Because every change is a view transition, anything that differs between two
states animates. Give two elements an identical `view-transition-name` between
slides (steps) and they'll naturally animate.

Each transition can be defined using [view transition types]. Each slide's
`data-transition` attribute will be used (`fade`, or `slide`, or define your own
using the `:active-view-transition-type()` selector). `data-transition="none"`
skips the transition, and the default can be set by adding `data-transition` on
the `deck-shift` element itself. Durations are defined with
`--deck-step-duration` and `--deck-slide-duration`.

## Speaker notes

Any `<aside class="notes">` in a slide is hidden, and can be used for speaker
notes. In here, `<mark>` can be used to define an area where you press for each
step: the first `<mark>` is step 1, and so on.

[`deck-presenter`] shows these notes in the presenter view.

## Keys

- <kbd>Right</kbd>, <kbd>Space</kbd>, <kbd>PageDown</kbd> - next (slide or step).
- <kbd>Left</kbd>, <kbd>PageUp</kbd> - previous (slide or step).
- <kbd>Down</kbd>/<kbd>Up</kbd> - next/previous slide (skips steps).
- <kbd>Home</kbd>/<kbd>End</kbd> - first/last slide.
- <kbd>F</kbd> - full screen.
- <kbd>?</kbd> - show help.

Other components may their own keys, such as <kbd>S</kbd> for
[`deck-presenter`] and <kbd>R</kbd> for [`deck-recorder`].

Clicking the slide goes forward, clicking the left 20% goes back a slide. Swipes
also work, and links, buttons, form controls and anything with
`data-no-advance` won't be interfered with.

## API

- `goto(slide, step, { animate })`, `next()`, `prev()`, `nextSlide()`,
  `prevSlide()`, `first()`, `last()`. Each returns the `ViewTransition`, if one
  started.
- `slide`, `step`, `steps` (of the current slide), `slides`.
- `script()`: `[{ id, title, steps, cues }]`. `cues` is the notes text split at
  each `<mark>`: `cues[0]` is read on arrival, `cues[k]` from step k.
- `deckchange` event, a `DeckChangeEvent` with `slide`, `step`, `id`, `steps`
  and `count`.

### Commands

`<deck-shift>` takes [invoker commands], so any button can drive it without
script:

```html
<button command="--prev" commandfor="deck">Back</button>
<button command="--goto:intro.2" commandfor="deck">Intro, step 2</button>
<deck-shift id="deck">...</deck-shift>
```

`--next`, `--prev`, `--next-slide`, `--prev-slide`, `--first`, `--last`,
`--fullscreen`, `--help`, and `--goto:<slide>` or `--goto:<slide>.<step>` (an id
or a position from 1, as in the URL).

Other components can add their own commands, just like they can add keys, so
[`deck-presenter`] adds `--present`, while [`deck-recorder`] adds `--record`
and `--record-pause`.

### Extending

Other components (such as [`deck-controls`](../deck-controls),
[`deck-presenter`](../deck-presenter) and [`deck-recorder`](../deck-recorder))
use the deck around them. They provide good examples of how to extend the
functionality of your slide decks, to do common useful things.

`addShortcut(name, key, callback, description)` adds a command and a key to the
deck, and a row to its help dialgo. The deck fires a `DeckShortcutAddEvent`
(`deck-shift-shortcut-add`, with `name`, `key` and `description`). `commands`
lists every command the deck takes, which can be checked for presence of new
commands.

A deck in an iframe also takes
`postMessage({ deck: "goto", slide, step, animate })` (`deck` can be any method,
so `next`, `prev`, etc...). This allows embedding into other views, which is how
[`deck-presenter`] can drive the main deck from its open window.

[view transition types]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:active-view-transition-type
[`deck-presenter`]: ../deck-presenter
[`deck-recorder`]: ../deck-recorder
[invoker commands]: https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API
