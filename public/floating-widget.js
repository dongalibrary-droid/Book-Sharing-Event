(function () {
  "use strict";

  var WIDGET_ID = "donga-floating-widget";
  var STYLE_ID = "donga-floating-widget-style";
  var CONFIG_FILE = "floating-widget-config.json";
  var BOOK_URL = "https://dongalibrary-droid.github.io/Book-Sharing-Event/";
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
    return getScriptBaseUrl() + CONFIG_FILE;
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
      "#" + WIDGET_ID + " .donga-floating-direct::before,",
      "#" + WIDGET_ID + " .donga-floating-direct::after {",
      "  position: absolute;",
      "  left: 50%;",
      "  top: 39px;",
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
      "#" + WIDGET_ID + " .donga-floating-direct::after {",
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
      "  #" + WIDGET_ID + " .donga-floating-direct::before,",
      "  #" + WIDGET_ID + " .donga-floating-direct::after {",
      "    top: 35px;",
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
      "  #" + WIDGET_ID + " .donga-floating-direct::before,",
      "  #" + WIDGET_ID + " .donga-floating-direct::after,",
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
    image.src = src || BOOK_IMAGE;
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

  function render(config) {
    var existing = document.getElementById(WIDGET_ID);
    if (existing) existing.remove();

    if (!config.enabled) return;
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
