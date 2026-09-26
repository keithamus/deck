# deck-recorder

Records a talk given with a [`<deck-shift>`](../deck-shift) slide deck, and
turns the recording into a video.

```html
<script type="module" src="https://unpkg.com/deck-recorder"></script>
<deck-controls></deck-controls>
```

Or:

```sh
npm install deck-recorder
```

```js
import "deck-recorder";
```

Add `<deck-recorder>` to the page and press <kbd>R</kbd> to start recoding a
run-through of the deck. The microphone will begin recording (and, if
[`webcam-view`] is present, the camera stream too), as well as every slide and
step change, and any clicks and key presses. <kbd>.</kbd> will pause and resume,
and the recording marks the cut. Press <kbd>R</kbd> again to download the video
(`recording-<time>.webm`) and its flow (`recording-<time>.json`).

The flow is a [Puppeteer Replay] user flow which means a tool like
[Chrome DevTools Recorder] can replay it. `setViewport` and a `navigate` to
the deck, a `navigate` to `#<slide>.<step>` for each change, `click` (selectors
pierce shadow roots) and `keyDown`/`keyUp` steps, and a `customStep` named
`pause` at each cut. Every step also has `t`, the ms into the video it happened;
the flow also has `video` (its file name), `started`, `duration` and `slides`
(the deck's `script()`). Why is this useful? Combine it with `deck-replay` to
get a video!

```sh
npm install puppeteer @puppeteer/replay
npx deck-replay recording-<time>.json [--out video.mp4] [--headed]
```

That replays the recording in a browser, while also screen-recording the page in
Chrome as the steps play, laying the recording's sound under it.

## Styling & API

A REC pill shows while recording (`::part(indicator)`). `start()`, `pause()`,
`resume()`, `stop()` (resolves with `{ video, flow }`), `toggle()`, `recording`
and `paused` drive it from script, and it fires a bubbling
`deck-recorder-change` event (`DeckRecorderChangeEvent`, with `recording` and
`paused`) as they change.

It adds the custom `--record` and `--record-pause` commands, meaning it can be
scripted also.

[`webcam-view`]: ../webcam-view
[Puppeteer Replay]: https://github.com/puppeteer/replay
