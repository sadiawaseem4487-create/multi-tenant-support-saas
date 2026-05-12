/*!
 * multi-tenant-support-saas — embeddable chat loader
 *
 * Usage on customer websites:
 *
 *   <script
 *     src="https://multi-tenant-support-saas.vercel.app/embed.js"
 *     data-site-slug="acme-support"
 *     async
 *   ></script>
 *
 * Optional attributes:
 *   data-position      "bottom-right" | "bottom-left"  (default: bottom-right)
 *   data-primary-color "#0d9488"  (overrides the org's branded color)
 *   data-z-index       integer    (default: 2147483646)
 *
 * The loader injects a floating chat bubble at the chosen corner. Clicking
 * the bubble opens an iframe rendered from the SaaS origin, so all
 * tenant-aware logic (RAG, RBAC, branding, persona) runs server-side and
 * the customer's site only ships ~5KB of bootstrap JS.
 */
(function () {
  "use strict";

  if (window.__mtsChatLoaded) return;
  window.__mtsChatLoaded = true;

  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].src || "";
        if (src.indexOf("/embed.js") !== -1) return scripts[i];
      }
      return null;
    })();

  if (!currentScript) {
    console.warn("[mts-chat] could not locate own <script> tag");
    return;
  }

  var slug = (currentScript.getAttribute("data-site-slug") || "").trim();
  if (!slug) {
    console.warn("[mts-chat] missing required attribute: data-site-slug");
    return;
  }

  var origin = new URL(currentScript.src).origin;
  var position = (currentScript.getAttribute("data-position") || "bottom-right").toLowerCase();
  var primaryColor = (currentScript.getAttribute("data-primary-color") || "").trim();
  var zIndex = parseInt(currentScript.getAttribute("data-z-index") || "2147483646", 10);

  var iframeUrl =
    origin + "/embed/" + encodeURIComponent(slug) +
    (primaryColor ? "?color=" + encodeURIComponent(primaryColor) : "");

  var sideStyle = position === "bottom-left"
    ? "left: 20px; right: auto;"
    : "right: 20px; left: auto;";
  var panelSideStyle = position === "bottom-left"
    ? "left: 20px; right: auto;"
    : "right: 20px; left: auto;";
  var bubbleColor = primaryColor || "#0d9488";

  var style = document.createElement("style");
  style.textContent = [
    ".mts-chat-bubble{position:fixed;bottom:20px;width:56px;height:56px;border-radius:9999px;",
    "background:" + bubbleColor + ";color:#fff;display:flex;align-items:center;justify-content:center;",
    "cursor:pointer;border:none;outline:none;box-shadow:0 12px 24px rgba(15,23,42,.25);",
    "transition:transform .15s ease,opacity .15s ease;z-index:" + zIndex + ";",
    sideStyle,
    "}",
    ".mts-chat-bubble:hover{transform:scale(1.05);}",
    ".mts-chat-bubble svg{width:26px;height:26px;}",
    ".mts-chat-panel{position:fixed;bottom:88px;width:380px;max-width:calc(100vw - 40px);",
    "height:560px;max-height:calc(100dvh - 120px);background:#fff;border-radius:18px;",
    "box-shadow:0 24px 64px rgba(15,23,42,.28),0 0 0 1px rgba(15,23,42,.06);",
    "overflow:hidden;opacity:0;transform:translateY(12px) scale(.98);",
    "transition:opacity .15s ease,transform .15s ease;pointer-events:none;z-index:" + zIndex + ";",
    panelSideStyle,
    "}",
    ".mts-chat-panel.is-open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}",
    ".mts-chat-panel iframe{width:100%;height:100%;border:0;display:block;background:#fff;}",
    "@media (max-width:480px){.mts-chat-panel{width:calc(100vw - 24px);height:calc(100dvh - 96px);",
    "bottom:80px;left:12px;right:12px;}}",
  ].join("");
  document.head.appendChild(style);

  var bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "mts-chat-bubble";
  bubble.setAttribute("aria-label", "Open support chat");
  bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>' +
    '</svg>';

  var panel = document.createElement("div");
  panel.className = "mts-chat-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Support chat");
  panel.setAttribute("aria-hidden", "true");

  var iframe = document.createElement("iframe");
  iframe.title = "Support chat";
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("allow", "clipboard-write");
  iframe.referrerPolicy = "no-referrer-when-downgrade";
  panel.appendChild(iframe);

  var loaded = false;
  function setOpen(open) {
    if (open && !loaded) {
      iframe.src = iframeUrl;
      loaded = true;
    }
    if (open) {
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      bubble.setAttribute("aria-label", "Close support chat");
    } else {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      bubble.setAttribute("aria-label", "Open support chat");
    }
  }

  bubble.addEventListener("click", function () {
    setOpen(!panel.classList.contains("is-open"));
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("is-open")) {
      setOpen(false);
    }
  });

  function ready() {
    document.body.appendChild(panel);
    document.body.appendChild(bubble);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
