import { esc } from "./esc.js?v=nav16";
import { loadI18n, t } from "./i18n.js?v=nav16";
import {
  loadAccounts,
  setAccountId,
  clearAccount,
  homeFor,
  resolveNav,
} from "./session.js?v=nav16";
import { getStatus, askCopilot } from "./api-mock.js?v=nav16";
import { confirmDialog } from "./confirm.js?v=nav16";

/** 这些 App 不挂全局事态条（跟单待办等） */
const STATUS_MUTE_APPS = new Set(["aitools", "ingest"]);

export async function mountShell({ account, active }) {
  await loadI18n("zh-CN");
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
            <span class="sep">|</span>
            <span class="env">${esc(t("app.env"))}</span>
          </div>
          <nav class="main-menu" id="main-menu" aria-label="主菜单"></nav>
        </div>
        <div class="topbar-right">
          <button type="button" class="btn" id="btn-copilot">${esc(t("nav.copilot"))}</button>
          <div class="who"><strong id="who-name"></strong></div>
          <button type="button" class="btn" id="btn-switch">${esc(t("nav.switchAccount"))}</button>
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

  document.getElementById("who-name").textContent =
    `${account.name} · ${account.title}`;

  /* TOP：主菜单 = 仅系统级 App（aiSpace / 文档入库 / ai工具 …） */
  document.getElementById("main-menu").innerHTML = groups
    .map((g) => {
      const home = g.items[0]?.href || "#";
      const on = currentApp && g.id === currentApp.id;
      return `<a href="${home}" class="main-menu-item${on ? " active" : ""}">${esc(
        t(g.appKey)
      )}</a>`;
    })
    .join("");

  /* 侧栏：只渲染当前 App 的二级，竖排；绝不混入其它 App */
  const nav = document.getElementById("sidenav");
  const items = sideItems || [];
  if (!items.length) {
    nav.innerHTML = `<div class="muted small" style="padding:14px">暂无子页</div>`;
  } else {
    nav.innerHTML = items
      .map(
        (n) =>
          `<a href="${n.href}" class="${n.key === active ? "active" : ""}">${esc(
            t(n.labelKey)
          )}</a>`
      )
      .join("");
  }

  const rail = document.getElementById("status-rail");
  rail.classList.remove("show");
  rail.innerHTML = "";
  if (!STATUS_MUTE_APPS.has(currentApp?.id)) {
    const status = await getStatus(account, { appId: currentApp?.id || "" });
    if (status.length) {
      rail.classList.add("show");
      rail.innerHTML =
        `<span class="muted">${esc(t("status.prefix"))}：</span>` +
        status.map((s) => `<a href="${s.href}">${esc(s.text)}</a>`).join("；");
    }
  }

  const menu = document.getElementById("account-menu");
  const accounts = await loadAccounts();
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

  document.getElementById("btn-switch").onclick = () => {
    menu.classList.toggle("show");
  };
  document.addEventListener("click", (e) => {
    if (
      !menu.contains(e.target) &&
      e.target !== document.getElementById("btn-switch")
    ) {
      menu.classList.remove("show");
    }
  });
  menu.addEventListener("click", (e) => {
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
    location.href = homeFor(acc);
  });

  const row = document.getElementById("body-row");
  const openCopilot = () => row.classList.add("copilot-open");
  const closeCopilot = () => row.classList.remove("copilot-open");
  document.getElementById("btn-copilot").onclick = () => {
    row.classList.toggle("copilot-open");
  };
  document.getElementById("btn-copilot-close").onclick = closeCopilot;

  const msgs = document.getElementById("copilot-msgs");
  function appendMsg(role, text, actions = []) {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    const meta =
      role === "user" ? account.name : t("copilot.title");
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
            location.href = "./hr-import.html";
          }
          const flash = document.getElementById("flash");
          if (flash) {
            flash.textContent = "已按建议预填（须再点确认开通）";
            flash.classList.add("show");
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
    const res = await askCopilot({ account, question: q, pageKey: active });
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
