import { resolvePageLoader, canonicalizeUrl } from "./page-registry.js?v=nav33";
import { ensureShell, getShellAccount, refreshShellChrome } from "./shell.js?v=nav33";

let installed = false;
let navigating = false;

function isHardNav(url) {
  const n = url.pathname.split("/").pop() || "";
  return n === "login.html";
}

export function installSoftNav() {
  if (installed) return;
  installed = true;

  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!a) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      let url;
      try {
        url = new URL(a.getAttribute("href"), location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      if (!url.pathname.includes(".html")) return;
      if (isHardNav(url)) return;
      if (!resolvePageLoader(url)) return;
      e.preventDefault();
      softNavigate(url, { push: true });
    },
    true
  );

  window.addEventListener("popstate", () => {
    softNavigate(new URL(location.href), { push: false });
  });
}

/**
 * 软跳转：不整页刷新，换主区 + 调页面 activate。
 * @param {URL|string} to
 */
export async function softNavigate(to, { push = true } = {}) {
  const raw = typeof to === "string" ? new URL(to, location.href) : new URL(to.href);
  if (isHardNav(raw)) {
    location.href = raw.href;
    return;
  }
  const entry = resolvePageLoader(raw);
  if (!entry) {
    location.href = raw.href;
    return;
  }
  const url = entry.canon || canonicalizeUrl(raw);
  if (navigating) return;
  navigating = true;
  try {
    const account = getShellAccount();
    if (!account) {
      location.href = "./login.html";
      return;
    }
    const mod = await entry.load();
    if (mod.roles && !mod.roles.includes(account.role)) {
      navigating = false;
      await softNavigate(new URL("./no-access.html", location.href), { push: true });
      return;
    }
    const active =
      typeof mod.activeKey === "function"
        ? mod.activeKey(url)
        : mod.active || "my-deals";
    if (push) history.pushState({ soft: true }, "", url.href);
    else history.replaceState({ soft: true }, "", url.href);
    await refreshShellChrome(account, active);
    const slot = document.getElementById("main-slot");
    if (!slot) {
      location.href = url.href;
      return;
    }
    // 清理弹层
    document.getElementById("modal-root")?.remove();
    const modal = document.createElement("div");
    modal.id = "modal-root";
    document.body.appendChild(modal);

    slot.innerHTML = "";
    const root = document.createElement("div");
    root.id = "page-root";
    slot.appendChild(root);
    document.title = mod.title
      ? typeof mod.title === "function"
        ? mod.title(url)
        : mod.title
      : document.title;
    await mod.activate({ account, url, root });
  } finally {
    navigating = false;
  }
}

/** 首屏启动：挂壳 + 激活当前页模块 + 启用软导航 */
export async function startPage(mod) {
  const { requireAccount } = await import("./session.js?v=nav33");
  const account = await requireAccount();
  if (!account) return;
  if (mod.roles && !mod.roles.includes(account.role)) {
    location.href = "./no-access.html";
    return;
  }
  const url = new URL(location.href);
  const active =
    typeof mod.activeKey === "function"
      ? mod.activeKey(url)
      : mod.active || "my-deals";
  await ensureShell(account, active);
  installSoftNav();
  const slot = document.getElementById("main-slot");
  const root = slot || document.getElementById("page-root");
  if (!document.getElementById("modal-root")) {
    const m = document.createElement("div");
    m.id = "modal-root";
    document.body.appendChild(m);
  }
  await mod.activate({ account, url, root });
}
