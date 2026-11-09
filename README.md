# X Scroll Mode

A tiny browser extension that brings X's (Twitter's) TikTok / Reels-style vertical video feed to the desktop site.

On the X phone app, tapping a video opens a full-screen feed where you scroll from one video to the next. That feed also exists in the desktop web app, but X hides it. This extension adds a button that opens it.

## Features

- **▶ Scroll mode** button (bottom right) opens the video feed, starting from the video closest to the middle of your screen.
- Pause / play with the **space bar** or by **clicking the video**.
- **Volume slider** under the arrows; the level you pick carries over to every next video. Its lowest step is 5%; to fully mute, use X's own speaker button.
- Move between videos with the **mouse wheel**, the **↑ / ↓ arrow keys**, or the **▲ / ▼ buttons** on the right side of the feed.
- Works in Brave, Chrome, Edge and other Chromium browsers.

## Install

1. Download this repo (**Code → Download ZIP**) and unzip it, or `git clone` it.
2. Open `brave://extensions` (or `chrome://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick the `x-scroll-mode` folder.
5. Open [x.com](https://x.com), scroll to any video and click **▶ Scroll mode**.

You need to be logged in to X.

## How it works

X's desktop web app already contains the video feed (`/<user>/status/<id>/mediaViewer`), but it is held back in three ways. The content script works around each one:

1. **Feature switch.** The page is gated behind the `explore_relaunch_enable_immersive_web` switch, which is off for desktop users. The script finds X's Redux store through the React root and turns the switch on.
2. **Screen width check.** When the screen is wide, the feed sends you back to the normal post. The script reports a phone-sized `screen.width` while the feed is open.
3. **Empty feed.** X only fetches the "next videos" list when it has to load the first post itself. The script removes that post from X's cache so the full list gets fetched.

Then it navigates with `history.pushState` plus a `popstate` event so X's router opens the feed without a page reload.

## Known limits

- Pressing **F5 inside the feed** shows "This page doesn't exist", because the switch is only turned on in memory. Go back and click the button again.
- The button only sees videos that have already loaded on the page. With autoplay off in X's settings it may say "No video on screen".
- If the video is inside a quoted post, the outer post is opened.
- This relies on X's internal code. If X changes its site, the extension may stop working.

## License

MIT
