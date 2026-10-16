# webcam-view

A custom element that shows the webcam, or plays a video in its place, and can
key out a green screen.

```html
<script type="module" src="https://unpkg.com/webcam-view"></script>
<webcam-view></webcam-view>
```

```sh
npm install webcam-view
```

```js
import "webcam-view";
```

```html
<webcam-view mirror></webcam-view>
```

`<webcam-view>` shows the camera, filling its box. Place and size it like any
element. Add the `mirror` attribute to flips the video, `::part(video)` styles
the video, and `view-transition-name` keeps it live through transitions. Its
`stream` is a promise of the camera's `MediaStream`. Set `src` to a video URL
to play that, with sound, instead of the camera (null goes back); `video` is
the `<video>` it plays.

Set `--chromakey` to the colour of a backdrop, like a green screen, to key it
out and show the page through. It's a custom property, so it inherits and can
change with the slide or step:

```css
html[data-slide="title"] webcam-view {
  --chromakey: lime;
}
```

The backdrop's own colour, as the camera sees it, keys cleanest.
`--chromakey-similarity` (default `0.75`) is how far a colour can be from the
key and still go: `0` is the key alone, `1` reaches grey.
`--chromakey-smoothness` (`0.15`) fades colours near that cut-off instead of
dropping them, `--chromakey-feather` (`0`) blurs the cut over that many camera
pixels (`2` smooths a webcam's blocky edge; much more leaves a halo, and it
doubles the work per frame), and `--chromakey-spill` (`0.2`) takes the key's
tint off what's left. Keying needs WebGL 2; without it the video shows as is.
A `src` video is keyed too, so a [`deck-recorder`]
replay keys the same way. A cross-origin `src` is only keyed if it's served with
CORS and `video.crossOrigin` is set before `src`; otherwise it plays as is.

[`deck-recorder`]: ../deck-recorder
