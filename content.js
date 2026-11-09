// Runs in the page's own JS world (manifest "world": "MAIN") because it must touch X's internal state.
const FLAG = 'explore_relaunch_enable_immersive_web';
const inViewer = () => /\/mediaViewer$/i.test(location.pathname);

// X's video feed sends you back to the post when the screen is wide. Pretend it is a phone while the feed is open.
const realWidth = Object.getOwnPropertyDescriptor(Screen.prototype, 'width').get;
Object.defineProperty(Screen.prototype, 'width', {
  configurable: true,
  get() {
    return inViewer() ? 400 : realWidth.call(this);
  },
});

// X keeps its on/off switches in a redux store hanging off the React root.
function findStore() {
  const root = document.getElementById('react-root');
  const key = root && Object.keys(root).find((k) => k.startsWith('__reactContainer'));
  const stack = [key ? root[key] : root?._reactRootContainer?._internalRoot?.current];
  for (let n = 0; stack.length && n < 5000; n++) {
    const f = stack.pop();
    if (!f) continue;
    if (f.memoizedProps?.store?.getState) return f.memoizedProps.store;
    stack.push(f.sibling, f.child);
  }
}

const btn = document.createElement('button');
btn.textContent = '▶ Scroll mode';
btn.style.cssText =
  'position:fixed;right:20px;bottom:20px;z-index:99999;padding:10px 16px;border:0;' +
  'border-radius:999px;background:#1d9bf0;color:#fff;font:bold 14px sans-serif;cursor:pointer';

btn.onclick = () => {
  const mid = innerHeight / 2;
  const dist = (v) => {
    const r = v.getBoundingClientRect();
    return Math.abs((r.top + r.bottom) / 2 - mid);
  };
  const video = [...document.querySelectorAll('article [data-testid="videoPlayer"], article video')].sort(
    (a, b) => dist(a) - dist(b)
  )[0];
  const m = [...(video?.closest('article').querySelectorAll('a[href*="/status/"]') ?? [])]
    .map((a) => a.getAttribute('href').match(/^\/(\w+)\/status\/(\d+)/))
    .find(Boolean);
  if (!m) {
    btn.textContent = 'No video on screen';
    setTimeout(() => (btn.textContent = '▶ Scroll mode'), 2000);
    return;
  }
  // shortcut: the switch lives in memory, so F5 inside the feed shows "page doesn't exist"; patch window.__INITIAL_STATE__ at document_start if that matters
  const state = findStore()?.getState();
  if (state) {
    state.featureSwitch.defaultConfig[FLAG] = state.featureSwitch.user.config[FLAG] = { value: true };
    // X only loads the next videos when it has to fetch the first post itself, so make it forget this one
    delete state.entities?.tweets?.entities?.[m[2]];
  }
  history.pushState({}, '', `/${m[1]}/status/${m[2]}/mediaViewer?currentTweet=${m[2]}&currentTweetUser=${m[1]}`);
  dispatchEvent(new Event('resize')); // makes X re-read the (now fake) screen width
  dispatchEvent(new PopStateEvent('popstate')); // makes X's router notice the new URL
};

// next (1) / previous (-1) video
const step = (dir) => {
  const feed = document.querySelector('[data-testid="vss-scroll-view"]');
  feed?.scrollBy({ top: dir * feed.clientHeight, behavior: 'smooth' });
};

// the video in the middle of the screen is the one playing
const currentVideo = () => {
  const mid = innerHeight / 2;
  return [...document.querySelectorAll('[data-testid="vss-scroll-view"] video')].find((v) => {
    const r = v.getBoundingClientRect();
    return r.top <= mid && r.bottom >= mid;
  });
};
const togglePlay = () => {
  const v = currentVideo();
  if (v) v.paused ? v.play() : v.pause();
};

// capture phase: X focuses its Close button when the feed opens, so a normal Space would close the feed
addEventListener(
  'keydown',
  (e) => {
    if (!inViewer() || e.target.matches('input, textarea, [contenteditable]')) return;
    const dir = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (dir) {
      e.preventDefault();
      step(dir);
    } else if (e.code === 'Space') {
      e.preventDefault();
      e.stopImmediatePropagation();
      togglePlay();
    }
  },
  true
);

// click on the video itself pauses / plays; clicks on X's own buttons, links and the progress bar are left alone
addEventListener('click', (e) => {
  if (!inViewer() || e.target.closest('button, a, input, [role="button"], [role="slider"], [role="link"]')) return;
  if (e.target.closest('[data-testid="videoComponent"], [data-testid="videoPlayer"]')) togglePlay();
});

// on-screen arrows, shown only inside the video feed
const arrows = document.createElement('div');
arrows.hidden = true;
arrows.style.cssText = 'position:fixed;right:20px;top:50%;transform:translateY(-50%);z-index:99999';
for (const [label, name, dir] of [['▲', 'Previous video', -1], ['▼', 'Next video', 1]]) {
  const b = document.createElement('button');
  b.textContent = label;
  b.title = name;
  b.setAttribute('aria-label', name);
  b.style.cssText =
    'display:block;width:44px;height:44px;margin:8px 0;border:0;border-radius:50%;' +
    'background:rgba(255,255,255,.2);color:#fff;font-size:18px;cursor:pointer';
  b.onclick = () => step(dir);
  arrows.append(b);
}

// volume slider under the arrows; once touched, every video in the feed uses it
let volume = null;
const applyVolume = (v) => {
  if (volume === null || !v.closest('[data-testid="vss-scroll-view"]')) return;
  // only volume, never `muted`: X undoes any mute it didn't do itself and jumps back to full volume
  if (v.volume !== volume) v.volume = volume;
};
const slider = document.createElement('input');
slider.type = 'range';
// not 0: X treats volume 0 as a mute, fights it and the video stalls; X's own speaker button still mutes
slider.min = 0.05;
slider.max = 1;
slider.step = 0.05;
slider.value = 1;
slider.title = 'Volume';
slider.setAttribute('aria-label', 'Volume');
slider.style.cssText = 'display:block;height:110px;margin:12px auto 0;writing-mode:vertical-lr;direction:rtl;cursor:pointer';
slider.oninput = () => {
  volume = Number(slider.value);
  document.querySelectorAll('[data-testid="vss-scroll-view"] video').forEach(applyVolume);
};
arrows.append(slider);
// the next video starts with X's own volume, so set ours again when it plays (play doesn't bubble, hence capture)
addEventListener('play', (e) => applyVolume(e.target), true);

document.documentElement.append(btn, arrows);
// main button outside the feed, arrows inside it
setInterval(() => {
  btn.hidden = inViewer();
  arrows.hidden = !inViewer();
}, 500);
