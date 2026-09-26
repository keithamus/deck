# deck-controls

On-screen playback controls for a [`<deck-shift>`](../deck-shift) slide deck.

```html
<script type="module" src="https://unpkg.com/deck-controls@1.0.0"></script>
<deck-controls></deck-controls>
```

Or:

```sh
npm install deck-controls
```

```js
import "deck-controls";
```

Add `<deck-controls>` for on-screen controls: a compact floating toolbar will
show on mouse move with a scrubber (a segment per slide), and icon buttons for
the presenter view, recording (with pause while it runs), full screen and help.
It shows while the mouse moves and hides, with the cursor.

The CSS custom properties `--deck-ui-bg`, `--deck-ui-fg`, `--deck-ui-accent` and
`--deck-ui-track` can be used to style it. Or select `::part(bar)`.

It stays out of sight until mouse movement in the window, so a deck in an iframe
never shows it.
