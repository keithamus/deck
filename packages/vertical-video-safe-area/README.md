# vertical-video-safe-area

Overlays a red transparent border to help you avoid putting content into areas
which might interfere with short form video platforms like Instagram, YouTube
Shorts, Tiktok, and so on.

```html
<script type="module" src="https://unpkg.com/vertical-video-safe-area"></script>
<vertical-video-safe-area></vertical-video-safe-area>
```

Or:

```sh
npm install vertical-video-safe-area
```

```js
import "vertical-video-safe-area";
```

Add `<vertical-video-safe-area>` to add the overlay. This will also cause the
`--deck-width` and `--deck-height` to be oriented to vertical video.

Icons are also shown for the comment and favourite buttons, in a placement which
is quite common - both YouTube Shorts and Tiktok feature buttons in this area,
meaning you can use this for alignment (or point to them if you're using the
webcam!)
