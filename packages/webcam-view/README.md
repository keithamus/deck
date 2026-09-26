# webcam-view

A custom element that shows the webcam, or plays a video in its place.

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
the `<video>` it shows.
