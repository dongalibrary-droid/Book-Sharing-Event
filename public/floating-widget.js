(function () {
  "use strict";

  var WIDGET_ID = "donga-floating-widget";
  var STYLE_ID = "donga-floating-widget-style";
  var CONFIG_FILE = "floating-widget-config.json";
  var BOOK_URL = "https://dongalibrary-droid.github.io/Book-Sharing-Event/";
  var SCRIPT_BASE_URL = getScriptBaseUrl();
  var BOOK_IMAGE = "https://dongalibrary-droid.github.io/Book-Sharing-Event/assets/images/book-sharing-floating.png?v=177fa37";

  var defaultConfig = {
    enabled: true,
    mode: "direct",
    position: {
      left: "24px",
      bottom: "48px",
      mobileLeft: "14px",
      mobileBottom: "calc(16px + env(safe-area-inset-bottom))"
    },
    trigger: {
      label: "도서 무료나눔",
      badge: "바로가기",
      image: BOOK_IMAGE
    },
    items: [
      {
        kind: "book",
        label: "도서 무료나눔",
        url: BOOK_URL,
        image: BOOK_IMAGE,
        ariaLabel: "도서 무료나눔 바로가기"
      }
    ]
  };

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function getScriptBaseUrl() {
    var script = document.currentScript;
    if (!script || !script.src) return BOOK_URL;
    return script.src.split("/").slice(0, -1).join("/") + "/";
  }

  function getConfigUrl() {
    if (window.DONGA_FLOATING_WIDGET_CONFIG_URL) {
      return String(window.DONGA_FLOATING_WIDGET_CONFIG_URL);
    }
    return SCRIPT_BASE_URL + CONFIG_FILE;
  }

  function withCacheBuster(url) {
    return url + (url.indexOf("?") === -1 ? "?" : "&") + "v=" + Date.now();
  }

  function mergeConfig(config) {
    config = config && typeof config === "object" ? config : {};

    return {
      enabled: config.enabled !== false,
      mode: String(config.mode || defaultConfig.mode),
      position: Object.assign({}, defaultConfig.position, config.position || {}),
      trigger: Object.assign({}, defaultConfig.trigger, config.trigger || {}),
      items: Array.isArray(config.items) && config.items.length ? config.items : defaultConfig.items
    };
  }

  function fetchConfig() {
    if (window.DONGA_FLOATING_WIDGET_CONFIG) {
      return Promise.resolve(mergeConfig(window.DONGA_FLOATING_WIDGET_CONFIG));
    }
    return fetch(withCacheBuster(getConfigUrl()), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Config request failed");
        return response.json();
      })
      .then(mergeConfig)
      .catch(function () {
        return mergeConfig(defaultConfig);
      });
  }

  function cssValue(value, fallback) {
    var text = String(value || fallback || "").trim();
    if (!text || /[;{}<>]/.test(text)) return fallback;
    return text;
  }

  function buildStyles(config) {
    var position = config.position || defaultConfig.position;
    var left = cssValue(position.left, defaultConfig.position.left);
    var bottom = cssValue(position.bottom, defaultConfig.position.bottom);
    var mobileLeft = cssValue(position.mobileLeft, defaultConfig.position.mobileLeft);
    var mobileBottom = cssValue(position.mobileBottom, defaultConfig.position.mobileBottom);

    return [
      "#" + WIDGET_ID + " {",
      "  position: fixed;",
      "  left: " + left + ";",
      "  bottom: " + bottom + ";",
      "  z-index: 99998;",
      "  font-family: inherit;",
      "}",
      "#" + WIDGET_ID + " * { box-sizing: border-box; }",
      "#" + WIDGET_ID + " a,",
      "#" + WIDGET_ID + " button { font: inherit; }",
      "#" + WIDGET_ID + " .donga-floating-direct {",
      "  position: relative;",
      "  display: grid;",
      "  justify-items: center;",
      "  gap: 7px;",
      "  width: 108px;",
      "  padding: 0;",
      "  border: 0;",
      "  border-radius: 22px;",
      "  background: transparent;",
      "  color: #245c1e;",
      "  text-decoration: none;",
      "  isolation: isolate;",
      "  transition: transform .18s ease;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-direct-thumb::before,",
      "#" + WIDGET_ID + " .donga-floating-direct-thumb::after {",
      "  position: absolute;",
      "  left: 50%;",
      "  top: 50%;",
      "  z-index: -1;",
      "  width: 76px;",
      "  height: 76px;",
      "  content: '';",
      "  border: 2px solid rgba(255, 111, 15, .52);",
      "  border-radius: 50%;",
      "  transform: translate(-50%, -50%) scale(.88);",
      "  animation: dongaFloatingPulse 2.2s ease-out infinite;",
      "  pointer-events: none;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-direct-thumb::after {",
      "  border-color: rgba(255, 111, 15, .34);",
      "  animation-delay: 1.05s;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-direct:hover,",
      "#" + WIDGET_ID + " .donga-floating-direct:focus-visible {",
      "  transform: translateY(-3px);",
      "}",
      "#" + WIDGET_ID + " .donga-floating-direct:focus-visible,",
      "#" + WIDGET_ID + " .donga-floating-trigger:focus-visible,",
      "#" + WIDGET_ID + " .donga-floating-item:focus-visible {",
      "  outline: 2px solid rgba(255, 111, 15, .72);",
      "  outline-offset: 5px;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-direct-thumb {",
      "  position: relative;",
      "  display: grid;",
      "  place-items: center;",
      "  width: 78px;",
      "  height: 78px;",
      "  border-radius: 50%;",
      "  border: 1px solid rgba(255, 255, 255, .70);",
      "  background: linear-gradient(135deg, rgba(255, 255, 255, .88), rgba(255, 248, 239, .74));",
      "  box-shadow: 0 16px 34px rgba(255, 111, 15, .24), 0 6px 18px rgba(36, 48, 62, .14), inset 0 1px 0 rgba(255, 255, 255, .92);",
      "  backdrop-filter: blur(12px) saturate(1.1);",
      "  -webkit-backdrop-filter: blur(12px) saturate(1.1);",
      "  isolation: isolate;",
      "}",
      "#" + WIDGET_ID + " img {",
      "  display: block;",
      "  object-fit: contain;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-direct-thumb img {",
      "  width: 63px;",
      "  height: 63px;",
      "  filter: drop-shadow(0 6px 10px rgba(255, 111, 15, .18));",
      "}",
      "#" + WIDGET_ID + " .donga-floating-direct-text {",
      "  display: block;",
      "  max-width: 100%;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-direct-label {",
      "  display: block;",
      "  padding: 6px 10px;",
      "  border: 1px solid rgba(255, 111, 15, .20);",
      "  border-radius: 999px;",
      "  background: rgba(255, 255, 255, .72);",
      "  color: #245c1e;",
      "  box-shadow: 0 10px 22px rgba(255, 111, 15, .16), inset 0 1px 0 rgba(255, 255, 255, .86);",
      "  backdrop-filter: blur(10px);",
      "  -webkit-backdrop-filter: blur(10px);",
      "  font-size: 14px;",
      "  font-weight: 900;",
      "  line-height: 1.18;",
      "  white-space: nowrap;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-direct-badge {",
      "  display: none;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-shell {",
      "  position: relative;",
      "  display: grid;",
      "  justify-items: start;",
      "  gap: 10px;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-menu {",
      "  position: absolute;",
      "  left: 0;",
      "  bottom: calc(100% + 12px);",
      "  display: grid;",
      "  grid-template-columns: 1fr;",
      "  gap: 8px;",
      "  min-width: 210px;",
      "  padding: 10px;",
      "  border: 1px solid rgba(255, 255, 255, .56);",
      "  border-radius: 26px;",
      "  background: rgba(255, 255, 255, .76);",
      "  box-shadow: 0 18px 46px rgba(36, 48, 62, .22), inset 0 1px 0 rgba(255, 255, 255, .82);",
      "  backdrop-filter: blur(14px) saturate(1.08);",
      "  -webkit-backdrop-filter: blur(14px) saturate(1.08);",
      "  opacity: 0;",
      "  pointer-events: none;",
      "  transform: translateY(10px) scale(.96);",
      "  transform-origin: left bottom;",
      "  transition: opacity .18s ease, transform .18s ease;",
      "}",
      "#" + WIDGET_ID + "[data-open='true'] .donga-floating-menu {",
      "  opacity: 1;",
      "  pointer-events: auto;",
      "  transform: translateY(0) scale(1);",
      "}",
      "#" + WIDGET_ID + " .donga-floating-item {",
      "  display: grid;",
      "  grid-template-columns: 44px 1fr;",
      "  align-items: center;",
      "  gap: 10px;",
      "  min-height: 58px;",
      "  padding: 7px 12px 7px 7px;",
      "  border: 1px solid rgba(255, 255, 255, .58);",
      "  border-radius: 18px;",
      "  background: rgba(255, 255, 255, .64);",
      "  color: #143255;",
      "  text-decoration: none;",
      "  box-shadow: 0 8px 20px rgba(22, 38, 56, .11);",
      "  transition: transform .16s ease, background .16s ease, box-shadow .16s ease;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-item:hover {",
      "  background: rgba(255, 255, 255, .82);",
      "  box-shadow: 0 10px 24px rgba(22, 38, 56, .16);",
      "  transform: translateY(-1px);",
      "}",
      "#" + WIDGET_ID + " .donga-floating-thumb {",
      "  display: grid;",
      "  place-items: center;",
      "  width: 44px;",
      "  height: 44px;",
      "  border-radius: 50%;",
      "  background: rgba(255, 255, 255, .84);",
      "  box-shadow: inset 0 0 0 1px rgba(15, 53, 86, .10), 0 6px 14px rgba(15, 53, 86, .12);",
      "}",
      "#" + WIDGET_ID + " .donga-floating-thumb img {",
      "  width: 34px;",
      "  height: 34px;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-label {",
      "  color: #123251;",
      "  font-size: 16px;",
      "  font-weight: 800;",
      "  line-height: 1.2;",
      "  white-space: nowrap;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-item-book .donga-floating-label { color: #245c1e; }",
      "#" + WIDGET_ID + " .donga-floating-trigger {",
      "  position: relative;",
      "  display: grid;",
      "  grid-template-columns: 48px 1fr 18px;",
      "  align-items: center;",
      "  gap: 9px;",
      "  min-width: 186px;",
      "  min-height: 62px;",
      "  padding: 8px 13px 8px 8px;",
      "  border: 1px solid rgba(255, 255, 255, .62);",
      "  border-radius: 999px;",
      "  background: rgba(255, 255, 255, .78);",
      "  color: #173454;",
      "  cursor: pointer;",
      "  box-shadow: 0 16px 38px rgba(36, 48, 62, .20), inset 0 1px 0 rgba(255, 255, 255, .84);",
      "  backdrop-filter: blur(14px) saturate(1.08);",
      "  -webkit-backdrop-filter: blur(14px) saturate(1.08);",
      "  isolation: isolate;",
      "  transition: transform .18s ease, box-shadow .18s ease, background .18s ease;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-trigger::before,",
      "#" + WIDGET_ID + " .donga-floating-trigger::after {",
      "  position: absolute;",
      "  left: 23px;",
      "  top: 50%;",
      "  z-index: -1;",
      "  width: 44px;",
      "  height: 44px;",
      "  content: '';",
      "  border: 2px solid rgba(255, 111, 15, .48);",
      "  border-radius: 50%;",
      "  transform: translate(-50%, -50%) scale(.88);",
      "  animation: dongaFloatingPulse 2.35s ease-out infinite;",
      "  pointer-events: none;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-trigger::after { animation-delay: 1.12s; }",
      "#" + WIDGET_ID + " .donga-floating-trigger:hover {",
      "  background: rgba(255, 255, 255, .86);",
      "  transform: translateY(-2px);",
      "}",
      "#" + WIDGET_ID + " .donga-floating-trigger-thumb {",
      "  display: grid;",
      "  place-items: center;",
      "  width: 48px;",
      "  height: 48px;",
      "  border-radius: 50%;",
      "  background: rgba(255, 255, 255, .86);",
      "}",
      "#" + WIDGET_ID + " .donga-floating-trigger-thumb img {",
      "  width: 38px;",
      "  height: 38px;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-trigger-text {",
      "  color: #173454;",
      "  font-size: 15px;",
      "  font-weight: 900;",
      "  line-height: 1.15;",
      "  white-space: nowrap;",
      "}",
      "#" + WIDGET_ID + " .donga-floating-caret {",
      "  width: 9px;",
      "  height: 9px;",
      "  border-right: 2px solid currentColor;",
      "  border-bottom: 2px solid currentColor;",
      "  transform: rotate(-135deg);",
      "  transition: transform .18s ease;",
      "}",
      "#" + WIDGET_ID + "[data-open='true'] .donga-floating-caret { transform: rotate(45deg); }",
      "@keyframes dongaFloatingPulse {",
      "  0% { opacity: .76; transform: translate(-50%, -50%) scale(.88); }",
      "  64% { opacity: .23; transform: translate(-50%, -50%) scale(1.58); }",
      "  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.86); }",
      "}",
      "@media (max-width: 768px) {",
      "  #" + WIDGET_ID + " {",
      "    left: " + mobileLeft + ";",
      "    bottom: " + mobileBottom + ";",
      "  }",
      "  #" + WIDGET_ID + " .donga-floating-direct {",
      "    width: 96px;",
      "  }",
      "  #" + WIDGET_ID + " .donga-floating-direct-thumb {",
      "    width: 70px;",
      "    height: 70px;",
      "  }",
      "  #" + WIDGET_ID + " .donga-floating-direct-thumb img {",
      "    width: 57px;",
      "    height: 57px;",
      "  }",
      "  #" + WIDGET_ID + " .donga-floating-direct-label {",
      "    padding: 5px 9px;",
      "    font-size: 12px;",
      "  }",
      "  #" + WIDGET_ID + " .donga-floating-direct-thumb::before,",
      "  #" + WIDGET_ID + " .donga-floating-direct-thumb::after {",
      "    width: 68px;",
      "    height: 68px;",
      "  }",
      "  #" + WIDGET_ID + " .donga-floating-menu { min-width: 190px; }",
      "  #" + WIDGET_ID + " .donga-floating-trigger {",
      "    grid-template-columns: 44px 1fr 16px;",
      "    min-width: 166px;",
      "    min-height: 56px;",
      "  }",
      "  #" + WIDGET_ID + " .donga-floating-trigger-thumb { width: 44px; height: 44px; }",
      "  #" + WIDGET_ID + " .donga-floating-trigger-thumb img { width: 34px; height: 34px; }",
      "  #" + WIDGET_ID + " .donga-floating-trigger-text { font-size: 14px; }",
      "}",
      "@media (prefers-reduced-motion: reduce) {",
      "  #" + WIDGET_ID + " .donga-floating-direct-thumb::before,",
      "  #" + WIDGET_ID + " .donga-floating-direct-thumb::after,",
      "  #" + WIDGET_ID + " .donga-floating-trigger::before,",
      "  #" + WIDGET_ID + " .donga-floating-trigger::after {",
      "    animation: none;",
      "  }",
      "}"
    ].join("\n");
  }

  function injectStyles(config) {
    var oldStyle = document.getElementById(STYLE_ID);
    if (oldStyle) oldStyle.remove();

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = buildStyles(config);
    document.head.appendChild(style);
  }

  function createImage(src) {
    var image = document.createElement("img");
    image.src = new URL(src || BOOK_IMAGE, SCRIPT_BASE_URL).href;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    return image;
  }

  function cleanKind(kind) {
    return String(kind || "").replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  }

  function getPrimaryItem(config) {
    return config.items && config.items.length ? config.items[0] : defaultConfig.items[0];
  }

  function createDirectLink(config) {
    var item = getPrimaryItem(config);
    var link = document.createElement("a");
    link.className = "donga-floating-direct donga-floating-direct-" + cleanKind(item.kind || "book");
    link.href = item.url || BOOK_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", item.ariaLabel || item.label || "도서 무료나눔 바로가기");

    var thumb = document.createElement("span");
    thumb.className = "donga-floating-direct-thumb";
    thumb.setAttribute("aria-hidden", "true");
    thumb.appendChild(createImage(item.image || config.trigger.image));

    var text = document.createElement("span");
    text.className = "donga-floating-direct-text";

    var label = document.createElement("span");
    label.className = "donga-floating-direct-label";
    label.textContent = config.trigger.label || item.label || "도서 무료나눔";

    var badge = document.createElement("span");
    badge.className = "donga-floating-direct-badge";
    badge.textContent = config.trigger.badge || "바로가기";

    text.appendChild(label);
    text.appendChild(badge);
    link.appendChild(thumb);
    link.appendChild(text);
    return link;
  }

  function createMenuItem(item) {
    var link = document.createElement("a");
    var kind = cleanKind(item.kind);
    link.className = "donga-floating-item" + (kind ? " donga-floating-item-" + kind : "");
    link.href = item.url || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", item.ariaLabel || item.label || "바로가기");

    var thumb = document.createElement("span");
    thumb.className = "donga-floating-thumb";
    thumb.setAttribute("aria-hidden", "true");
    thumb.appendChild(createImage(item.image));

    var label = document.createElement("span");
    label.className = "donga-floating-label";
    label.textContent = item.label || "바로가기";

    link.appendChild(thumb);
    link.appendChild(label);
    return link;
  }

  function createMenuWidget(config, root) {
    var shell = document.createElement("div");
    shell.className = "donga-floating-shell";

    var menu = document.createElement("nav");
    menu.className = "donga-floating-menu";
    menu.setAttribute("aria-label", "도서관 바로가기");

    config.items.forEach(function (item) {
      if (!item || !item.url) return;
      menu.appendChild(createMenuItem(item));
    });

    var button = document.createElement("button");
    button.type = "button";
    button.className = "donga-floating-trigger";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "도서관 서비스 바로가기 메뉴 열기");

    var triggerThumb = document.createElement("span");
    triggerThumb.className = "donga-floating-trigger-thumb";
    triggerThumb.setAttribute("aria-hidden", "true");
    triggerThumb.appendChild(createImage(config.trigger.image));

    var triggerText = document.createElement("span");
    triggerText.className = "donga-floating-trigger-text";
    triggerText.textContent = config.trigger.label || "도서관 서비스";

    var caret = document.createElement("span");
    caret.className = "donga-floating-caret";
    caret.setAttribute("aria-hidden", "true");

    button.appendChild(triggerThumb);
    button.appendChild(triggerText);
    button.appendChild(caret);
    shell.appendChild(menu);
    shell.appendChild(button);
    root.appendChild(shell);

    function setOpen(isOpen) {
      root.dataset.open = isOpen ? "true" : "false";
      button.setAttribute("aria-expanded", isOpen ? "true" : "false");
      button.setAttribute("aria-label", isOpen ? "도서관 서비스 바로가기 메뉴 닫기" : "도서관 서비스 바로가기 메뉴 열기");
    }

    button.addEventListener("click", function () {
      setOpen(root.dataset.open !== "true");
    });

    document.addEventListener("click", function (event) {
      if (root.contains(event.target)) return;
      setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });

    if (window.location.hash === "#open") {
      window.setTimeout(function () {
        setOpen(true);
      }, 120);
    }
  }


  function playResearchIntro(root, config) {
    if (!config.trigger.video) return;
    var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    var frame = root.querySelector(".research-image");
    var video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    video.tabIndex = -1;
    video.preload = "metadata";
    video.poster = frame.querySelector("img").src;
    video.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;border:1px solid #d5e0eb;border-radius:8px;background:white;pointer-events:none;opacity:0;";
    var finished = false;
    var timer;
    function showImage(fade) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      motion.removeEventListener("change", onMotionChange);
      video.pause();
      function removeVideo() {
        video.removeAttribute("src");
        video.load();
        video.remove();
      }
      if (fade === true && !motion.matches) {
        // Keep the final video frame while revealing the image underneath.
        video.style.transition = "opacity 500ms ease-in-out";
        video.style.opacity = "0";
        setTimeout(removeVideo, 550);
      } else {
        removeVideo();
      }
    }
    function onMotionChange(event) { if (event.matches) showImage(); }
    function waitForPlayback() {
      clearTimeout(timer);
      timer = setTimeout(showImage, 12000);
    }
    video.addEventListener("playing", function () {
      clearTimeout(timer);
      video.style.opacity = "1";
    });
    video.addEventListener("waiting", waitForPlayback);
    video.addEventListener("ended", function () { showImage(true); }, { once: true });
    video.addEventListener("error", showImage, { once: true });
    motion.addEventListener("change", onMotionChange);
    frame.appendChild(video);
    video.src = new URL(config.trigger.video, SCRIPT_BASE_URL).href;
    waitForPlayback();
    video.play().catch(showImage);
  }

  function renderResearch(config) {
    var previous = document.getElementById("research-widget");
    if (previous) previous.remove();
    var style = document.getElementById("donga-research-style") || document.createElement("style");
    style.id = "donga-research-style";
    // Fade items without translating them beyond the scroll container.
    style.textContent = "#research-widget, #research-widget * { box-sizing: border-box; letter-spacing: 0; }\n    #research-widget { position: fixed; left: 24px; bottom: 36px; z-index: 99998; width: 136px; }\n    #research-widget button { font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }\n    .research-trigger { position: relative; display: grid; justify-items: center; gap: 8px; width: 136px; padding: 0; border: 0; background: transparent; color: #163f65; }\n    .research-image { position: relative; display: grid; place-items: center; width: 104px; height: 104px; isolation: isolate; }\n    .research-image img { display: block; width: 104px; height: 104px; object-fit: contain; border: 1px solid #d5e0eb; border-radius: 8px; background: white; box-shadow: 0 4px 14px #193f641a; }\n    .research-image::before, .research-image::after { content: \"\"; position: absolute; inset: 0; z-index: -1; border: 2px solid #197cb8; border-radius: 8px; pointer-events: none; animation: research-wave 3s ease-out infinite; }\n    .research-image::after { border-color: #e34388; animation-delay: 1.5s; }\n    @keyframes research-wave { 0% { transform: scale(1); opacity: .65; border-radius: 8px; } 85%, 100% { transform: scale(1.3); opacity: 0; border-radius: 24px; } }\n    .research-label { display: block; padding: 4px 10px; font-size: 13px; font-weight: 800; line-height: 1.45; background: rgba(255, 255, 255, .16); border: 1px solid rgba(255, 255, 255, .40); backdrop-filter: blur(4px) saturate(1.15); -webkit-backdrop-filter: blur(4px) saturate(1.15); border-radius: 6px; box-shadow: 0 3px 10px #173b5508, inset 0 1px 0 #ffffff40; }\n    .research-label span { display: block; color: #2166ad; background: linear-gradient(110deg, #086eb0 0%, #77509d 52%, #df307e 100%); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }\n    .research-toggle-mark { position: absolute; right: 9px; top: -6px; width: 26px; height: 26px; border-radius: 50%; background: #164e7c; border: 2px solid white; color: white; display: grid; place-items: center; }\n    .research-toggle-mark::before { content: \"\"; width: 7px; height: 7px; border-left: 2px solid; border-top: 2px solid; transform: translateY(2px) rotate(45deg); transition: transform .2s; }\n    [data-open=\"true\"] .research-toggle-mark::before { transform: translateY(-2px) rotate(225deg); }\n    [data-open=\"true\"] .research-image::before, [data-open=\"true\"] .research-image::after { animation-play-state: paused; opacity: 0; }\n    .research-menu { position: absolute; bottom: calc(100% + 14px); left: 0; width: 190px; max-width: calc(100vw - 40px); max-height: calc(100dvh - 216px); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: 4px; display: grid; gap: 6px; }\n    .research-menu[hidden] { display: none; }\n    .research-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 54px; padding: 6px 10px 6px 7px; border: 1px solid #d8e3eb; border-radius: 8px; background: #ffffffed; color: #183b56; box-shadow: 0 3px 8px #173b550c; text-align: left; animation: research-enter .24s ease-out both; }\n    .research-item:nth-child(2) { animation-delay: .045s; }\n    .research-item:nth-child(3) { animation-delay: .09s; }\n    .research-item img { width: 38px; height: 38px; object-fit: contain; border-radius: 4px; flex-shrink: 0; }\n    .research-item { text-decoration: none; }\n    .research-item span { font-size: 13px; font-weight: 700; }\n    .research-item:hover { background: #eef6fb; border-color: #6e9dbc; }\n    .research-item:last-child:hover { background: #fffbe0; border-color: #c5b756; }\n    #research-widget :is(button, a):focus-visible { outline: 3px solid #1689c1; outline-offset: 3px; }\n    @keyframes research-enter { from { opacity: 0; } to { opacity: 1; } }\n    @media (max-width: 600px) {\n      #research-widget { left: 14px; bottom: calc(16px + env(safe-area-inset-bottom)); width: 120px; }\n      .research-trigger { width: 120px; gap: 7px; } .research-image, .research-image img { width: 88px; height: 88px; }\n      .research-label { font-size: 12px; } .research-menu { width: 180px; max-height: calc(100dvh - 182px - env(safe-area-inset-bottom)); bottom: calc(100% + 12px); }\n    }\n    @media (prefers-reduced-motion: reduce) {\n      .research-image::before, .research-image::after { animation: none; opacity: 0; }\n      .research-item { animation: none; } .research-toggle-mark::before { transition: none; }\n    }\n";
    document.head.appendChild(style);
    document.body.insertAdjacentHTML("beforeend", "<div id=\"research-widget\" data-open=\"false\">\n    <nav class=\"research-menu\" id=\"research-menu\" aria-label=\"누구나 연구자 경진대회 바로가기\" hidden>\n      <a class=\"research-item\" href=\"https://docs.google.com/forms/d/e/1FAIpQLSfuL3emvc4E-NTPlAUwzH41p7fd5_VGTDEo2Q0L-jxAgyIAtg/viewform?usp=header\" target=\"_blank\" rel=\"noopener noreferrer\"><img src=\"assets/apply.png\" alt=\"\"><span>대회 참가신청</span></a>\n      <a class=\"research-item\" href=\"https://eclass.donga.ac.kr/courses/6a9a465672417bd5030103d9\" target=\"_blank\" rel=\"noopener noreferrer\"><img src=\"assets/lms.png\" alt=\"\"><span>LMS 교육</span></a>\n      <a class=\"research-item\" href=\"https://open.kakao.com/o/ggVyTTMi\" target=\"_blank\" rel=\"noopener noreferrer\"><img src=\"assets/chat.png\" alt=\"\"><span>24시간 질문방</span></a>\n    </nav>\n    <button class=\"research-trigger\" id=\"research-trigger\" type=\"button\" aria-expanded=\"false\" aria-controls=\"research-menu\" aria-label=\"누구나 연구자 경진대회 메뉴 열기\">\n      <span class=\"research-image\"><img src=\"assets/researcher.png\" alt=\"\"></span>\n      <span class=\"research-toggle-mark\" aria-hidden=\"true\"></span>\n      <span class=\"research-label\"><span>누구나 연구자</span><span>경진대회</span></span>\n    </button>\n  </div>");
    var root = document.getElementById("research-widget");
    root.querySelector(".research-image img").src = new URL(config.trigger.image, SCRIPT_BASE_URL).href;
    playResearchIntro(root, config);
    var labelText = document.createElement("span");
    labelText.textContent = config.trigger.label;
    root.querySelector(".research-label").replaceChildren(labelText);
    root.querySelector(".research-label").style.maxWidth = "120px";
    root.querySelector(".research-label").style.wordBreak = "keep-all";
    root.querySelectorAll(".research-item").forEach(function (link, index) {
      var item = config.items[index];
      if (!item) { link.remove(); return; }
      link.href = item.url;
      link.querySelector("img").src = new URL(item.image, SCRIPT_BASE_URL).href;
      link.querySelector("span").textContent = item.label;
    });

    const widget = document.getElementById("research-widget");
    const trigger = document.getElementById("research-trigger");
    const menu = document.getElementById("research-menu");
    function setOpen(open, focusFirst = false) {
      widget.dataset.open = String(open);
      trigger.setAttribute("aria-expanded", String(open));
      trigger.setAttribute("aria-label", "누구나 연구자 경진대회 메뉴 " + (open ? "닫기" : "열기"));
      menu.hidden = !open;
      if (open && focusFirst) menu.querySelector("a").focus();
    }
    trigger.addEventListener("click", () => setOpen(menu.hidden));
    trigger.addEventListener("keydown", event => {
      if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true, true); }
    });
    document.addEventListener("pointerdown", event => { if (!widget.contains(event.target)) setOpen(false); });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !menu.hidden) { setOpen(false); trigger.focus(); }
    });
    widget.addEventListener("focusout", () => {
      setTimeout(() => { if (!widget.contains(document.activeElement)) setOpen(false); }, 0);
    });
    menu.addEventListener("click", event => { if (event.target.closest("a")) setOpen(false); });

  }
  function render(config) {
    var existing = document.getElementById(WIDGET_ID);
    if (existing) existing.remove();

    if (!config.enabled) return;
    if (config.mode === "researcher") { renderResearch(config); return; }
    injectStyles(config);

    var root = document.createElement("div");
    root.id = WIDGET_ID;
    root.dataset.open = "false";

    if (config.mode === "direct" || config.items.length <= 1) {
      root.appendChild(createDirectLink(config));
    } else {
      createMenuWidget(config, root);
    }

    document.body.appendChild(root);
  }

  whenReady(function () {
    fetchConfig().then(render);
  });
}());
