(function () {
  'use strict';
  if (document.getElementById('donga-awards-coming-soon')) return;
  const base = new URL('.', document.currentScript.src);
  const asset = name => new URL(name, base).href;
  const host = document.createElement('div');
  host.id = 'donga-awards-coming-soon';
  host.style.cssText = 'position:relative;z-index:99998;';
  const shadow = host.attachShadow({mode:'open'});
  const style = document.createElement('style');
  style.textContent = ':host { font-family: "Malgun Gothic", system-ui, sans-serif; letter-spacing:0; }' + "\n    * { box-sizing: border-box; }\n    body { margin: 0; background: #f8fafb; color: #25343e; font-family: \"Malgun Gothic\", system-ui, sans-serif; letter-spacing: 0; }\n    button, a { -webkit-tap-highlight-color: transparent; }\n    .wrap { width: min(100%, 1080px); margin: auto; padding: 28px; }\n    header { background: #fff; border-bottom: 1px solid #dce4e9; }\n    .top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }\n    .brand { font-size: 21px; }\n    .sample { color: #77838b; font-size: 12px; }\n    .nav { display: flex; flex-wrap: wrap; gap: 26px; margin-top: 24px; font-size: 14px; color: #526570; }\n    main { min-height: 110vh; }\n    .heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 24px 0 28px; }\n    h1 { margin: 0; font-size: 26px; }\n    .replay { display: inline-flex; align-items: center; justify-content: center; gap: 7px; flex-shrink: 0; min-height: 40px; padding: 8px 12px; border: 1px solid #cdd8df; border-radius: 6px; color: #354c5b; background: white; font: inherit; font-size: 13px; cursor: pointer; }\n    .replay:hover { background: #eef4f7; }\n    .replay span { font-size: 21px; line-height: 1; }\n    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; border-top: 2px solid #365b6d; }\n    section { padding: 24px 0; }\n    h2 { margin: 0 0 16px; font-size: 18px; }\n    .notice { padding: 16px 0; border-bottom: 1px solid #dce4e9; font-size: 15px; line-height: 1.7; }\n    .notice small { display: block; color: #77838b; font-size: 12px; }\n    footer { border-top: 1px solid #dce4e9; color: #77838b; font-size: 12px; }\n    .floating { position: fixed; left: 24px; bottom: calc(26px + env(safe-area-inset-bottom)); z-index: 100; width: 164px; text-align: center; }\n    .floating-preview { display: grid; justify-items: center; gap: 0; color: #493024; cursor: default; text-decoration: none; }\n    .floating-preview[href] { cursor: pointer; }\n    .media { position: relative; display: block; width: 140px; height: 140px; isolation: isolate; }\n    .media img, .media video { display: block; width: 100%; height: 100%; object-fit: contain; }\n    .media img { position: relative; z-index: 1; opacity: 1; transition: opacity .7s ease; filter: drop-shadow(0 0 4px rgba(215, 174, 108, .7)); animation: trophy-glow 2.8s ease-in-out infinite; }\n    .media.is-playing img { opacity: 0; transition: none; animation: none; filter: none; }\n    .media video { position: absolute; inset: 0; border-radius: 8px; filter: drop-shadow(0 0 1px #d8ad8c99) drop-shadow(0 0 4px #f1d0ad66) drop-shadow(0 3px 7px #bd8b7133); opacity: 0; transition: opacity .7s ease; pointer-events: none; }\n    .media video.playing { opacity: 1; transition: none; }\n    /* Apply the halo directly to the alpha silhouette; no masked or hidden layer. */\n    @keyframes trophy-glow {\n      0%, 100% { filter: drop-shadow(0 0 2.5px rgba(215, 174, 108, .55)); }\n      50% { filter: drop-shadow(0 0 9px rgba(215, 174, 108, 1)); }\n    }\n    .label { width: 164px; padding: 8px 4px; border: 1px solid #c9a85280; border-radius: 6px; background: #fffffff0; box-shadow: 0 3px 12px #49302412; }\n    .label small { display: block; font-size: 11px; font-weight: 700; line-height: 1.6; white-space: nowrap; }\n    .label strong { display: block; margin-top: 3px; font-size: 18px; font-variant-numeric: tabular-nums; line-height: 1.4; color: #784b3d; white-space: nowrap; }\n    :is(a, button):focus-visible { outline: 3px solid #247fa5; outline-offset: 5px; }\n    @media (max-width: 600px) {\n      .wrap { padding: 22px; }\n      .brand { font-size: 18px; }\n      .nav { gap: 16px; font-size: 12px; }\n      h1 { font-size: 22px; }\n      .columns { grid-template-columns: 1fr; gap: 0; }\n      .floating { left: 12px; bottom: calc(16px + env(safe-area-inset-bottom)); width: 150px; }\n      .media { width: 116px; height: 116px; }\n      .label { width: 150px; padding: 6px 3px; }\n      .label small { font-size: 10px; }\n      .label strong { font-size: 17px; }\n    }\n    @media (prefers-reduced-motion: reduce) { .media img, .media video { transition: none; } }\n    @media (prefers-reduced-motion: reduce) { .media img { animation: none; } }\n  "
    .replaceAll('trophy-video-last-frame.png', asset('trophy-video-last-frame.png'));
  shadow.append(style);
  const template = document.createElement('template');
  template.innerHTML = "<aside class=\"floating\" aria-label=\"누구나 연구자 경진대회\">\n    <a class=\"floating-preview\" id=\"awards-link\">\n      <span class=\"media\" id=\"media\">\n        <img src=\"trophy-video-last-frame.png\" alt=\"\" width=\"140\" height=\"140\">\n      </span>\n      <span class=\"label\"><small>누구나 연구자 경진대회</small><strong id=\"awards-label\"><time datetime=\"2026-10-29\">10월 29일</time> 공개</strong></span>\n    </a>\n  </aside>";
  shadow.append(template.content.cloneNode(true));
  shadow.querySelector('img').src = asset('trophy-video-last-frame.png');
  document.body.append(host);
  
    const releaseAt = Date.parse('2026-10-29T00:00:00+09:00');
    const resultUrl = 'https://dongalib1946.github.io/EveryResearcher/index.html';
    let releaseTimer;
    function updateRelease() {
      clearTimeout(releaseTimer);
      const remaining = releaseAt - Date.now();
      if (remaining <= 0) {
        shadow.getElementById('awards-label').textContent = '수상 결과 확인';
        const link = shadow.getElementById('awards-link');
        link.href = resultUrl;
        link.setAttribute('aria-label', '누구나 연구자 경진대회 수상 결과 확인');
      } else {
        // Use total hours so a countdown longer than one day does not wrap at 24.
        const secondsLeft = Math.ceil(remaining / 1000);
        const hours = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
        const minutes = String(Math.floor(secondsLeft / 60) % 60).padStart(2, '0');
        const seconds = String(secondsLeft % 60).padStart(2, '0');
        shadow.getElementById('awards-label').textContent = `${hours}:${minutes}:${seconds} 후 공개`;
        const link = shadow.getElementById('awards-link');
        link.removeAttribute('href');
        link.removeAttribute('aria-label');
        // Recompute from the clock on every tick, including after a suspended tab resumes.
        releaseTimer = setTimeout(updateRelease, remaining % 1000 || 1000);
      }
    }
    document.addEventListener('visibilitychange', updateRelease);
    window.addEventListener('pageshow', updateRelease);
    updateRelease();

    const media = shadow.getElementById('media');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cleanup = () => {};

    // iOS browsers use WebKit too. Desktop Chromium must keep the WebM alpha path.
    function usesAppleVideo() {
      const ua = navigator.userAgent;
      const ios = /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return ios || (/Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua));
    }

    function playIntro(explicit = false) {
      cleanup();
      if (reducedMotion.matches && !explicit) return;
      const video = document.createElement('video');
      let timer, removeTimer, finished = false, disposed = false;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('aria-hidden', 'true');
      video.setAttribute('disablepictureinpicture', '');
      video.tabIndex = -1;
      const appleVideo = usesAppleVideo();
      // Unsupported Apple devices keep the transparent poster instead of a black video.
      if (appleVideo && !video.canPlayType('video/quicktime; codecs="hvc1"') &&
          !video.canPlayType('video/mp4; codecs="hvc1"')) return;
      video.src = appleVideo ? asset('intro-transparent-hevc.mov') : asset('intro-transparent.webm');
      const dispose = () => {
        disposed = true;
        clearTimeout(timer);
        clearTimeout(removeTimer);
        media.classList.remove('is-playing');
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.remove();
      };
      cleanup = dispose;
      const finish = () => {
        if (finished || disposed) return;
        finished = true;
        clearTimeout(timer);
        // Keep the last video frame mounted while it fades over the static image.
        video.classList.remove('playing');
        media.classList.remove('is-playing');
        removeTimer = setTimeout(dispose, reducedMotion.matches ? 0 : 750);
      };
      const watchdog = () => {
        if (finished || disposed) return;
        clearTimeout(timer);
        timer = setTimeout(finish, 12000);
      };
      video.addEventListener('playing', () => {
        if (!finished && !disposed) {
          video.classList.add('playing');
          media.classList.add('is-playing');
        }
        watchdog();
      });
      video.addEventListener('timeupdate', watchdog);
      video.addEventListener('ended', finish);
      video.addEventListener('error', finish);
      media.append(video);
      watchdog();
      video.play().catch(finish);
    }
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) cleanup(); });
    window.addEventListener('pagehide', () => cleanup());
    playIntro();
  
}());
