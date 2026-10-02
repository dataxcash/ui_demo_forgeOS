import { esc } from "./esc.js?v=nav51";
import { loadI18n, t } from "./i18n.js?v=nav51";
import {
  loadAccounts,
  setAccountId,
  clearAccount,
  homeFor,
  resolveNav,
} from "./session.js?v=nav51";
import { getStatus, askCopilot } from "./api-mock.js?v=nav51";
import { confirmDialog } from "./confirm.js?v=nav51";
import {
  iconForApp,
  iconForNavKey,
  navIconLabel,
} from "./icons.js?v=nav51";

const STATUS_MUTE_APPS = new Set(["aitools", "ingest"]);

let shellAccount = null;
let shellActive = null;
let shellWired = false;

export function getShellAccount() {
  return shellAccount;
}

/** 幂等：只建一次壳；之后只刷导航/事态 */
export async function ensureShell(account, active) {
  shellAccount = account;
  shellActive = active;
  await loadI18n("zh-CN");
  if (!document.querySelector(".app-shell")) {
    await buildShellDom(account, active);
  } else {
    await refreshShellChrome(account, active);
  }
}

/** @deprecated 兼容旧页；请用 ensureShell + startPage */
export async function mountShell({ account, active }) {
  await ensureShell(account, active);
  const { installSoftNav } = await import("./soft-nav.js?v=nav51");
  installSoftNav();
}

export async function refreshShellChrome(account, active) {
  shellAccount = account;
  shellActive = active;
  await loadI18n("zh-CN");
  const { groups, currentApp, sideItems } = resolveNav(account, active);
  const prevApp = document.body.dataset.app || "";
  document.body.dataset.app = currentApp?.id || "";
  document.body.classList.toggle(
    "status-muted",
    STATUS_MUTE_APPS.has(currentApp?.id)
  );

  const who = document.getElementById("who-name");
  if (who) who.textContent = account.name;

  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) {
    mainMenu.innerHTML = groups
      .map((g) => {
        const home = g.items[0]?.href || "#";
        const on = currentApp && g.id === currentApp.id;
        const ico = iconForApp(g.id);
        return `<a href="${home}" class="main-menu-item${on ? " active" : ""}">${navIconLabel(
          ico,
          esc(t(g.appKey))
        )}</a>`;
      })
      .join("");
  }

  const nav = document.getElementById("sidenav");
  if (nav) {
    const items = sideItems || [];
    const sameApp = prevApp && prevApp === (currentApp?.id || "");
    const sameLen =
      sameApp && nav.querySelectorAll("a[data-nav-key]").length === items.length;
    const hasIcons = !!nav.querySelector(".nav-ico");
    if (sameLen && items.length && hasIcons) {
      nav.querySelectorAll("a[data-nav-key]").forEach((a) => {
        a.classList.toggle("active", a.getAttribute("data-nav-key") === active);
      });
    } else if (!items.length) {
      nav.innerHTML = `<div class="muted small" style="padding:14px">暂无子页</div>`;
    } else {
      nav.innerHTML = items
        .map((n) => {
          const ico = iconForNavKey(n.key) || iconForNavKey(n.iconKey);
          return `<a href="${n.href}" data-nav-key="${esc(n.key)}" class="${
            n.key === active ? "active" : ""
          }">${navIconLabel(ico, esc(t(n.labelKey)))}</a>`;
        })
        .join("");
    }
  }

  const rail = document.getElementById("status-rail");
  if (rail) {
    if (STATUS_MUTE_APPS.has(currentApp?.id)) {
      rail.classList.remove("show");
      rail.innerHTML = "";
    } else {
      const status = await getStatus(account, { appId: currentApp?.id || "" });
      if (status.length) {
        rail.classList.add("show");
        rail.innerHTML =
          `<span class="muted">${esc(t("status.prefix"))}：</span>` +
          status.map((s) => `<a href="${s.href}">${esc(s.text)}</a>`).join("；");
      } else {
        rail.classList.remove("show");
        rail.innerHTML = "";
      }
    }
  }
}

async function buildShellDom(account, active) {
  const { groups, currentApp, sideItems } = resolveNav(account, active);
  document.body.dataset.app = currentApp?.id || "";
  document.body.classList.toggle(
    "status-muted",
    STATUS_MUTE_APPS.has(currentApp?.id)
  );

  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <div class="brand">
            <span>${esc(t("app.name"))}</span>
          </div>
          <nav class="main-menu" id="main-menu" aria-label="主菜单"></nav>
        </div>
        <div class="topbar-right">
          <button type="button" class="btn" id="btn-copilot">${esc(t("nav.copilot"))}</button>
          <button type="button" class="btn user-menu-btn" id="btn-user" aria-haspopup="true" aria-expanded="false">
            <span id="who-name"></span>
            <span class="chev" aria-hidden="true">▾</span>
          </button>
        </div>
      </header>
      <div class="account-menu" id="account-menu"></div>
      <div class="status-rail" id="status-rail"></div>
      <div class="body-row" id="body-row">
        <nav class="sidenav" id="sidenav" aria-label="二级菜单"></nav>
        <main class="main" id="main-slot"></main>
        <aside class="copilot" id="copilot" aria-label="智能助理">
          <div class="copilot-head">
            <span>${esc(t("copilot.title"))}</span>
            <button type="button" class="btn btn-ghost" id="btn-copilot-close" style="color:var(--text-secondary);padding:2px 6px">${esc(t("nav.copilotClose"))}</button>
          </div>
          <div class="copilot-msgs" id="copilot-msgs"></div>
          <div class="copilot-input">
            <textarea id="copilot-q" placeholder="${esc(t("copilot.placeholder"))}"></textarea>
            <button type="button" class="btn btn-primary" id="copilot-send">${esc(t("copilot.send"))}</button>
          </div>
        </aside>
      </div>
    </div>`
  );

  const main = document.getElementById("page-root");
  const slot = document.getElementById("main-slot");
  if (main && slot) {
    while (main.firstChild) slot.appendChild(main.firstChild);
    main.remove();
  }

  await refreshShellChrome(account, active);

  if (!shellWired) {
    shellWired = true;
    wireShellChrome(account, active);
  }
}

function wireShellChrome(account, active) {
  const menu = document.getElementById("account-menu");
  loadAccounts().then((accounts) => {
    menu.innerHTML =
      accounts
        .map((a) => {
          const stub = a.stub ? " stub" : "";
          const extra = a.stub ? ` · ${t("account.stub")}` : "";
          return `<button type="button" class="${stub}" data-id="${esc(a.id)}">
          <strong>${esc(a.name)}</strong><br/><span class="muted small">${esc(
            a.title
          )}${esc(extra)}</span>
        </button>`;
        })
        .join("") +
      `<div class="hint">${esc(t("account.hint"))}</div>
     <button type="button" data-id="__logout">${esc(t("nav.logout"))}</button>`;

    document.getElementById("btn-user").onclick = (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle("show");
      document.getElementById("btn-user").setAttribute("aria-expanded", open ? "true" : "false");
    };
    document.addEventListener("click", (e) => {
      if (
        !menu.contains(e.target) &&
        e.target !== document.getElementById("btn-user") &&
        !document.getElementById("btn-user")?.contains(e.target)
      ) {
        menu.classList.remove("show");
        document.getElementById("btn-user")?.setAttribute("aria-expanded", "false");
      }
    });
    menu.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      if (id === "__logout") {
        clearAccount();
        location.href = "./login.html";
        return;
      }
      const acc = accounts.find((a) => a.id === id);
      if (!acc || acc.stub) return;
      setAccountId(id);
      menu.classList.remove("show");
      const { softNavigate } = await import("./soft-nav.js?v=nav51");
      shellAccount = acc;
      await softNavigate(new URL(homeFor(acc), location.href), { push: true });
    });
  });

  const row = document.getElementById("body-row");
  const openCopilot = () => row.classList.add("copilot-open");
  document.getElementById("btn-copilot").onclick = () => {
    row.classList.toggle("copilot-open");
  };
  document.getElementById("btn-copilot-close").onclick = () =>
    row.classList.remove("copilot-open");

  const msgs = document.getElementById("copilot-msgs");
  function appendMsg(role, text, actions = []) {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    const meta = role === "user" ? shellAccount?.name || "" : t("copilot.title");
    let actHtml = "";
    if (actions.length) {
      actHtml =
        `<div class="actions">` +
        actions
          .map((a) => {
            if (a.href) {
              return `<a class="btn" style="margin:2px 4px 0 0;display:inline-block;font-size:12px;padding:3px 8px" href="${esc(
                a.href
              )}">${esc(a.label)}</a>`;
            }
            return `<button type="button" class="btn" style="margin:2px 4px 0 0;font-size:12px;padding:3px 8px" data-act="${esc(
              a.id
            )}" data-kind="${esc(a.kind || "")}">${esc(a.label)}</button>`;
          })
          .join("") +
        `</div>`;
    }
    div.innerHTML = `<div class="meta">${esc(meta)}</div><div class="bubble">${esc(
      text
    )}</div>${actHtml}`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    div.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.onclick = async () => {
        const kind = btn.getAttribute("data-kind");
        if (kind === "hr-prefill") {
          const ok = await confirmDialog({
            title: "确认预填",
            body: "仅预填勾选「正常」行，开通仍须总确认。",
            confirmText: "预填",
          });
          if (!ok) return;
          if (typeof window.__hrPrefillNormal === "function") {
            window.__hrPrefillNormal();
          } else {
            const { softNavigate } = await import("./soft-nav.js?v=nav51");
            await softNavigate(new URL("./hr-import.html", location.href), {
              push: true,
            });
          }
        }
      };
    });
  }

  appendMsg("assistant", t("copilot.welcome"));

  async function send() {
    const ta = document.getElementById("copilot-q");
    const q = ta.value.trim();
    if (!q) return;
    ta.value = "";
    appendMsg("user", q);
    openCopilot();
    const res = await askCopilot({
      account: shellAccount,
      question: q,
      pageKey: shellActive,
    });
    appendMsg("assistant", res.text, res.actions || []);
  }

  document.getElementById("copilot-send").onclick = send;
  document.getElementById("copilot-q").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
}
