import {
  getIngestState,
  browseIngestFs,
  ingestAddDirs,
  ingestRemoveDir,
  ingestMarkBootstrapInstalled,
  ingestSubmitAdmin,
  ingestMarkProbeReady,
  uploadIngestFiles,
  getIngestUploads,
  listIngestMachines,
  setSelectedIngestMachine,
  getSelectedIngestMachineId,
  registerIngestMachine,
  listSharedSources,
} from "../api-mock.js?v=nav50";
import { confirmDialog } from "../confirm.js?v=nav50";
import { esc } from "../esc.js?v=nav50";

export const roles = ["employee", "manager", "boss", "hr", "it"];
export const title = "文档入库";

const VIEWS = {
  upload: {
    key: "ingest-upload",
    title: "文件入库",
    sub: "选文件上传即可，后台自动入库（跟人走，不绑机器）。",
  },
  machines: {
    key: "ingest-machines",
    title: "我的机器",
    sub: "选择要管的电脑；一人可有多台，目录不串台。",
  },
  setup: {
    key: "ingest-setup",
    title: "接入向导",
    sub: "按步骤完成当前机器接入，每一步只做一件事。",
  },
  manage: {
    key: "sync-status",
    title: "入库管理",
    sub: "看当前机器进料是否正常；目录加入后即监视。",
  },
  fleet: {
    key: "ingest-fleet",
    title: "机器总览",
    sub: "全员机器连接与同步；可代管目标机。",
  },
  shared: {
    key: "ingest-shared",
    title: "共享源",
    sub: "公司 NAS / 文件服务器：由 IT 登记与监视。",
  },
};

export function activeKey(url) {
  let view = url.searchParams.get("view") || "upload";
  if (!VIEWS[view]) view = "upload";
  return VIEWS[view].key;
}

let ingestState = null;
/** @type {File[]} */
let uploadFiles = [];
let currentMachineId = null;

export async function activate({ account, url, root }) {
  root.innerHTML = `
    <div class="flash" id="flash"></div>
    <div class="page-head">
      <h1 id="title">—</h1>
      <p id="sub"></p>
    </div>
    <div id="machine-bar" class="machine-bar" hidden></div>
    <div id="view"></div>`;
  const viewEl = root.querySelector("#view");
  const machineBar = root.querySelector("#machine-bar");

  function tip(msg) {
    const flash = document.getElementById("flash");
    flash.textContent = msg;
    flash.classList.add("show");
  }

  function fmtSize(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function mapLegacy() {
    const p = location.pathname;
    if (p.includes("ingest-upload")) return "upload";
    if (p.includes("ingest-setup")) return "setup";
    if (p.includes("sync-status")) return "manage";
    if (p.includes("ingest-fleet")) return "fleet";
    if (p.includes("ingest-machines")) return "machines";
    if (p.includes("ingest-shared")) return "shared";
    return "";
  }

  function phaseLabel(phase) {
    if (phase === "ready") return { text: "已接入", cls: "ok" };
    if (phase === "provisioning") return { text: "部署中", cls: "warn" };
    if (phase === "need_admin") return { text: "待连接", cls: "warn" };
    if (phase === "need_bootstrap") return { text: "未接入", cls: "warn" };
    return { text: phase || "—", cls: "" };
  }

  async function switchView(next, pushUrl, machineId) {
    if ((next === "fleet" || next === "shared") && account.role !== "it") {
      tip(next === "shared" ? "无权限查看共享源" : "无权限查看机器总览");
      return;
    }
    if (!VIEWS[next]) next = "upload";
    const u = new URL(`./ingest.html?view=${next}`, location.href);
    const mid = machineId || currentMachineId;
    if (mid && next !== "upload" && next !== "machines" && next !== "shared") {
      u.searchParams.set("machine", mid);
    }
    const { softNavigate } = await import("../soft-nav.js?v=nav50");
    await softNavigate(u, { push: !!pushUrl });
  }

  async function ensureMachineContext(preferId) {
    const id = await getSelectedIngestMachineId(
      account,
      preferId || url.searchParams.get("machine")
    );
    if (!id) {
      currentMachineId = null;
      return null;
    }
    if (id !== currentMachineId) {
      await setSelectedIngestMachine(account, id);
      currentMachineId = id;
    }
    return id;
  }

  async function paintMachineBar(show) {
    if (!show) {
      machineBar.hidden = true;
      machineBar.innerHTML = "";
      return;
    }
    const s = ingestState;
    if (!s || !s.machineId) {
      machineBar.hidden = true;
      return;
    }
    const mine = s.ownerAccount === account.id;
    const tag = mine ? "本人机器" : "代管目标";
    machineBar.hidden = false;
    machineBar.innerHTML = `
      <div class="machine-bar-inner">
        <div>
          <span class="muted small">当前机器</span>
          <strong style="margin-left:6px">${esc(s.host)}</strong>
          <span class="muted small"> · ${esc(s.osDetail || s.osType || "")}</span>
          <span class="pill" style="margin-left:8px">${esc(tag)}</span>
          ${
            s.ownerName
              ? `<span class="muted small"> · ${esc(s.ownerName)}</span>`
              : ""
          }
        </div>
        <button type="button" class="btn" id="btn-switch-m">切换机器</button>
      </div>`;
    document.getElementById("btn-switch-m").onclick = () =>
      switchView("machines", true);
  }

  /* —— 文件入库 —— */
  async function paintUpload() {
    await paintMachineBar(false);
    uploadFiles = [];
    viewEl.innerHTML = `
    <div class="card upload-box">
      <div class="upload-drop" id="drop">
        <input type="file" id="file-input" multiple hidden />
        <p style="margin:0 0 10px">把文件拖到这里，或</p>
        <button type="button" class="btn btn-primary" id="btn-pick">选择文件</button>
      </div>
      <div id="picked" class="upload-picked muted small" hidden></div>
      <div class="actions" style="margin-top:12px">
        <button type="button" class="btn" id="btn-clear" disabled>清空</button>
        <button type="button" class="btn btn-primary" id="btn-upload" disabled>上传入库</button>
      </div>
    </div>
    <details class="tool-hist" id="up-hist-wrap" style="margin-top:16px">
      <summary>本会话已交后台</summary>
      <div id="up-hist"></div>
    </details>`;

    const input = document.getElementById("file-input");
    const drop = document.getElementById("drop");
    const pickedEl = document.getElementById("picked");
    const btnPick = document.getElementById("btn-pick");
    const btnClear = document.getElementById("btn-clear");
    const btnUpload = document.getElementById("btn-upload");

    function paintPicked() {
      const on = uploadFiles.length > 0;
      btnClear.disabled = !on;
      btnUpload.disabled = !on;
      if (!on) {
        pickedEl.hidden = true;
        pickedEl.innerHTML = "";
        return;
      }
      pickedEl.hidden = false;
      pickedEl.innerHTML =
        `已选 ${uploadFiles.length} 个` +
        `<ul style="margin:4px 0 0;padding-left:18px">` +
        uploadFiles
          .map(
            (f) =>
              `<li>${esc(f.name)} <span class="muted">(${fmtSize(
                f.size
              )})</span></li>`
          )
          .join("") +
        `</ul>`;
    }

    function addFiles(list) {
      const next = [...uploadFiles];
      for (const f of list) {
        if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
        next.push(f);
      }
      uploadFiles = next;
      paintPicked();
    }

    async function paintHist() {
      const { items } = await getIngestUploads();
      const wrap = document.getElementById("up-hist-wrap");
      const hist = document.getElementById("up-hist");
      if (!items.length) {
        wrap.hidden = true;
        hist.innerHTML = "";
        return;
      }
      wrap.hidden = false;
      hist.innerHTML = items
        .map(
          (b) => `<button type="button" class="tool-hist-item">
          <strong>${esc(b.at)} · ${b.files.length} 个</strong>
          <span class="muted small">${b.files
            .map((f) => esc(f.name))
            .join("；")}</span>
        </button>`
        )
        .join("");
    }

    btnPick.onclick = () => input.click();
    input.onchange = () => {
      addFiles([...input.files]);
      input.value = "";
    };
    btnClear.onclick = () => {
      uploadFiles = [];
      paintPicked();
    };
    btnUpload.onclick = async () => {
      if (!uploadFiles.length) return;
      btnUpload.disabled = true;
      const res = await uploadIngestFiles(
        account,
        uploadFiles.map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
        }))
      );
      if (!res.ok) {
        tip(res.error || "上传失败");
        btnUpload.disabled = false;
        return;
      }
      tip(`已交后台 ${res.accepted} 个文件`);
      uploadFiles = [];
      paintPicked();
      await paintHist();
    };
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("drag");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("drag");
      if (e.dataTransfer?.files?.length) addFiles([...e.dataTransfer.files]);
    });
    await paintHist();
  }

  /* —— 我的机器 —— */
  async function paintMachines() {
    await paintMachineBar(false);
    const { items } = await listIngestMachines(account);
    const selected = await getSelectedIngestMachineId(
      account,
      url.searchParams.get("machine")
    );
    viewEl.innerHTML = `
      <div class="toolbar" style="margin-bottom:12px">
        <p class="muted small" style="margin:0;flex:1">点选后可去做「接入向导」或「入库管理」。目录跟机器绑定。</p>
        <button type="button" class="btn btn-primary" id="btn-add-m">添加机器</button>
      </div>
      <div id="m-list"></div>`;
    const list = document.getElementById("m-list");
    if (!items.length) {
      list.innerHTML = `<div class="empty">还没有登记机器。点「添加机器」开始接入。</div>`;
    } else {
      list.innerHTML = items
        .map((m) => {
          const pl = phaseLabel(m.phase);
          const on = m.id === selected ? " is-selected" : "";
          return `<div class="card machine-card${on}" data-id="${esc(m.id)}">
            <div class="deal-main">
              <div class="deal-title">${esc(m.host)}</div>
              <div class="deal-meta">
                <span class="pill ${pl.cls}">${esc(pl.text)}</span>
                <span class="muted">${esc(m.osDetail || m.osType || "")}</span>
                <span class="muted">${m.dirCount} 个目录</span>
                ${
                  m.probe?.slimSync
                    ? `<span class="muted">同步 ${esc(m.probe.slimSync)}</span>`
                    : ""
                }
              </div>
            </div>
            <div class="machine-card-actions">
              <button type="button" class="btn" data-act="select">选用</button>
              ${
                m.phase === "ready"
                  ? `<button type="button" class="btn btn-primary" data-act="manage">入库管理</button>`
                  : `<button type="button" class="btn btn-primary" data-act="setup">去接入</button>`
              }
            </div>
          </div>`;
        })
        .join("");
    }

    document.getElementById("btn-add-m").onclick = async () => {
      const host = prompt("给这台机器起个名字", `${account.name}-新机器`);
      if (host === null) return;
      const res = await registerIngestMachine(account, {
        host: host.trim() || undefined,
      });
      if (!res.ok) {
        tip(res.error || "添加失败");
        return;
      }
      currentMachineId = res.machine.id;
      tip(`已登记「${res.machine.host}」，请完成接入`);
      switchView("setup", true, res.machine.id);
    };

    list.querySelectorAll(".machine-card").forEach((card) => {
      const id = card.getAttribute("data-id");
      card.querySelectorAll("[data-act]").forEach((btn) => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const act = btn.getAttribute("data-act");
          await setSelectedIngestMachine(account, id);
          currentMachineId = id;
          if (act === "setup") return switchView("setup", true, id);
          if (act === "manage") return switchView("manage", true, id);
          tip("已选用该机器");
          paintMachines();
        };
      });
      card.onclick = async () => {
        await setSelectedIngestMachine(account, id);
        currentMachineId = id;
        tip("已选用该机器");
        paintMachines();
      };
    });
  }

  /* —— 接入向导 —— */
  async function paintSetup() {
    const mid = await ensureMachineContext();
    if (!mid) {
      await paintMachineBar(false);
      viewEl.innerHTML = `
        <div class="empty">还没有可操作的机器。</div>
        <p style="margin-top:12px"><button type="button" class="btn btn-primary" id="go-m">去我的机器</button></p>`;
      document.getElementById("go-m").onclick = () =>
        switchView("machines", true);
      return;
    }
    ingestState = await getIngestState(account, mid);
    await paintMachineBar(true);
    const s = ingestState;
    let step = 2;
    if (s.bootstrap.installed && !s.adminAuth.done) step = 3;
    if (s.adminAuth.done && s.phase !== "ready") step = 4;
    if (s.phase === "ready") step = 5;

    const detectBar = `
    <div class="card" style="margin-bottom:12px">
      <div class="muted small">系统类型（目标机）</div>
      <div style="font-size:16px;font-weight:600;margin-top:4px">${esc(
        s.osType || "Windows"
      )} <span class="muted" style="font-weight:400;font-size:13px">· ${esc(
        s.osDetail || ""
      )} · ${esc(s.host || "")}</span></div>
    </div>`;

    if (step === 2) {
      viewEl.innerHTML =
        detectBar +
        `<div class="card">
        <h2 style="margin:0 0 8px;font-size:14px">安装连接服务</h2>
        <p style="margin:0 0 10px">请在<strong>目标机</strong>下载并安装连接服务，安装后保持运行，再继续。</p>
        <p class="muted small" style="margin:0 0 12px">${esc(s.host)} · 端口 ${
          s.bootstrap.port
        } · ${esc(s.bootstrap.downloadName)}</p>
        <div class="toolbar">
          <button type="button" class="btn btn-primary" id="btn-dl">下载安装包</button>
          <button type="button" class="btn" id="btn-check">我已安装，检查连通</button>
        </div>
      </div>`;
      document.getElementById("btn-dl").onclick = () =>
        tip("已开始下载");
      document.getElementById("btn-check").onclick = async () => {
        await ingestMarkBootstrapInstalled(account, mid);
        tip("连通正常");
        paintSetup();
      };
      return;
    }

    if (step === 3) {
      viewEl.innerHTML =
        detectBar +
        `<div class="card" style="max-width:440px">
        <h2 style="margin:0 0 8px;font-size:14px">连接目标机</h2>
        <p class="muted small" style="margin:0 0 12px">连通性：<span class="pill ok">已连通</span></p>
        <label class="muted small">账户</label>
        <input id="adm-user" style="width:100%;margin:4px 0 10px;padding:7px 8px;border:1px solid var(--line)" placeholder="目标机管理员账户" />
        <label class="muted small">密码</label>
        <input id="adm-pass" type="password" style="width:100%;margin:4px 0 8px;padding:7px 8px;border:1px solid var(--line)" />
        <p class="muted small" style="margin:0 0 12px">仅本次接入使用，系统不保存管理员密码。</p>
        <button type="button" class="btn btn-primary" id="btn-admin">开始部署</button>
      </div>`;
      document.getElementById("btn-admin").onclick = async () => {
        const u = document.getElementById("adm-user").value.trim();
        const p = document.getElementById("adm-pass").value;
        if (!u || !p) {
          tip("请填写账户和密码");
          return;
        }
        document.getElementById("adm-pass").value = "";
        await ingestSubmitAdmin(account, u, p, mid);
        paintSetup();
      };
      return;
    }

    if (step === 4) {
      viewEl.innerHTML =
        detectBar +
        `<div class="card">
        <h2 style="margin:0 0 8px;font-size:14px">正在安装与部署</h2>
        <div class="progress-list" id="prog">
          <div class="prog-item run">准备环境…</div>
          <div class="prog-item">创建服务账户…</div>
          <div class="prog-item">安装同步组件…</div>
          <div class="prog-item">校验运行状态…</div>
        </div>
      </div>`;
      if (!window.__ingestProgRunning) {
        window.__ingestProgRunning = true;
        runProgress(mid);
      }
      return;
    }

    viewEl.innerHTML =
      detectBar +
      `<div class="card">
      <h2 style="margin:0 0 8px;font-size:14px">接入结果</h2>
      <p style="margin:0 0 8px"><span class="pill ok">成功</span> 「${esc(
        s.host
      )}」已接入，可以管理入库目录。</p>
      <p class="muted small" style="margin:0 0 12px">同步组件 ${esc(
        s.probe.version || ""
      )} · ${esc(s.probe.slimSync)} · 心跳 ${esc(
        s.probe.lastHeartbeat || "—"
      )}</p>
      <button type="button" class="btn btn-primary" id="btn-to-manage">进入入库管理</button>
    </div>`;
    document.getElementById("btn-to-manage").onclick = () =>
      switchView("manage", true, mid);
  }

  async function runProgress(mid) {
    const labels = [
      "准备环境…",
      "创建服务账户…",
      "安装同步组件…",
      "校验运行状态…",
    ];
    for (let i = 0; i < labels.length; i++) {
      await new Promise((r) => setTimeout(r, 550));
      if (view !== "setup") break;
      const box = document.getElementById("prog");
      if (!box) break;
      box.innerHTML = labels
        .map((t, j) => {
          let cls = "";
          if (j < i) cls = "done";
          if (j === i) cls = "run";
          return `<div class="prog-item ${cls}">${esc(t)}${
            j < i ? " 完成" : ""
          }</div>`;
        })
        .join("");
    }
    await ingestMarkProbeReady(account, mid);
    window.__ingestProgRunning = false;
    tip("部署完成");
    if (view === "setup") paintSetup();
  }

  /* —— 入库管理 —— */
  function openAddDialog() {
    const wrap = document.getElementById("modal-root");
    let listing = { path: "", parent: null, entries: [] };
    const picked = new Map();

    wrap.innerHTML = `
    <div class="modal-backdrop show" id="dlg">
      <div class="modal modal-browse" role="dialog" aria-label="选择入库目录">
        <h3 style="margin:0 0 6px;font-size:15px">选择入库目录</h3>
        <p class="muted small" style="margin:0 0 10px">勾选可多选；双击文件夹进入下一级。目录写入当前机器。</p>
        <div class="fs-bar">
          <button type="button" class="btn" id="fs-up" disabled>上级</button>
          <div class="fs-path" id="fs-path">此电脑</div>
        </div>
        <div class="fs-list" id="fs-list" role="listbox" aria-multiselectable="true"></div>
        <div class="fs-selected muted small">已选 <strong id="fs-sel-count">0</strong> 个：<span id="fs-sel">无</span></div>
        <div class="actions">
          <button type="button" class="btn" id="dlg-cancel">取消</button>
          <button type="button" class="btn btn-primary" id="dlg-ok" disabled>确认添加</button>
        </div>
      </div>
    </div>`;

    const close = () => {
      wrap.innerHTML = "";
    };
    const okBtn = document.getElementById("dlg-ok");
    const upBtn = document.getElementById("fs-up");
    const pathEl = document.getElementById("fs-path");
    const listEl = document.getElementById("fs-list");
    const selEl = document.getElementById("fs-sel");
    const countEl = document.getElementById("fs-sel-count");

    function refreshPickedUi() {
      const items = [...picked.values()];
      countEl.textContent = String(items.length);
      selEl.textContent = items.length
        ? items.map((e) => e.path.replace(/\\$/, "")).join("；")
        : "无";
      okBtn.disabled = items.length === 0;
      okBtn.textContent =
        items.length > 1 ? `确认添加（${items.length}）` : "确认添加";
      listEl.querySelectorAll(".fs-item").forEach((el) => {
        const path = el.getAttribute("data-path");
        const on = picked.has(path);
        el.classList.toggle("selected", on);
        const cb = el.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = on;
      });
    }

    function togglePick(entry) {
      if (!entry || entry.kind === "drive") return;
      if (picked.has(entry.path)) picked.delete(entry.path);
      else picked.set(entry.path, entry);
      refreshPickedUi();
    }

    async function load(path) {
      listing = await browseIngestFs(path);
      pathEl.textContent = listing.path || "此电脑";
      upBtn.disabled = listing.parent === null;
      if (listing.error) {
        listEl.innerHTML = `<div class="empty">${esc(listing.error)}</div>`;
        refreshPickedUi();
        return;
      }
      if (!listing.entries.length) {
        listEl.innerHTML = `<div class="empty">此文件夹为空</div>`;
        refreshPickedUi();
        return;
      }
      listEl.innerHTML = listing.entries
        .map((e) => {
          if (e.kind === "drive") {
            return `<button type="button" class="fs-item" data-path="${esc(
              e.path
            )}" data-kind="drive" data-name="${esc(e.name)}">
            <span class="fs-ico">盘</span>
            <span class="fs-name">${esc(e.name)}</span>
          </button>`;
          }
          return `<label class="fs-item" data-path="${esc(
            e.path
          )}" data-kind="dir" data-name="${esc(e.name)}">
          <input type="checkbox" class="fs-check" />
          <span class="fs-ico">夹</span>
          <span class="fs-name">${esc(e.name)}</span>
        </label>`;
        })
        .join("");
      listEl.querySelectorAll(".fs-item").forEach((el) => {
        const entry = {
          name: el.getAttribute("data-name"),
          path: el.getAttribute("data-path"),
          kind: el.getAttribute("data-kind"),
        };
        if (entry.kind === "drive") {
          el.onclick = () => load(entry.path);
          return;
        }
        const cb = el.querySelector(".fs-check");
        cb.onclick = (ev) => {
          ev.stopPropagation();
          togglePick(entry);
        };
        el.ondblclick = (ev) => {
          ev.preventDefault();
          load(entry.path);
        };
      });
      refreshPickedUi();
    }

    upBtn.onclick = () => load(listing.parent === null ? "" : listing.parent);
    document.getElementById("dlg-cancel").onclick = close;
    document.getElementById("dlg").onclick = (e) => {
      if (e.target.id === "dlg") close();
    };
    okBtn.onclick = async () => {
      const paths = [...picked.keys()];
      if (!paths.length) {
        tip("请至少勾选一个文件夹");
        return;
      }
      const res = await ingestAddDirs(account, paths, currentMachineId);
      if (!res.ok) {
        tip(res.error || "添加失败");
        return;
      }
      close();
      const n = res.added?.length || paths.length;
      tip(
        res.skipped?.length
          ? `已加入 ${n} 个，跳过已存在 ${res.skipped.length} 个`
          : `已加入监视（${n}）`
      );
      ingestState = await getIngestState(account, currentMachineId);
      paintManage();
    };
    load("");
  }

  async function paintManage() {
    const mid = await ensureMachineContext();
    if (!mid) {
      await paintMachineBar(false);
      viewEl.innerHTML = `
        <div class="empty">还没有可管理的机器。</div>
        <p style="margin-top:12px"><button type="button" class="btn btn-primary" id="go-m">去我的机器</button></p>`;
      document.getElementById("go-m").onclick = () =>
        switchView("machines", true);
      return;
    }
    ingestState = await getIngestState(account, mid);
    await paintMachineBar(true);
    const s = ingestState;
    if (s.phase !== "ready") {
      viewEl.innerHTML = `
      <div class="dash">
        <div class="dash-health warn">
          <div class="dash-k">进料状态</div>
          <div class="dash-v">未接入</div>
        </div>
        <div class="dash-metrics dash-metrics-2">
          <div><span class="dash-k">今日进料</span><strong>—</strong></div>
          <div><span class="dash-k">监视目录</span><strong>—</strong></div>
        </div>
      </div>
      <p style="margin-top:14px">
        <button type="button" class="btn btn-primary" id="btn-to-setup">去接入向导</button>
      </p>`;
      document.getElementById("btn-to-setup").onclick = () =>
        switchView("setup", true, mid);
      return;
    }

    const st = s.stats || {};
    const dirs = Array.isArray(s.dirs) ? s.dirs : [];
    const online = s.probe.slimSync === "在线";
    viewEl.innerHTML = `
    <div class="dash">
      <div class="dash-health ${online ? "ok" : "warn"}">
        <div class="dash-k">进料状态</div>
        <div class="dash-v">${online ? "正常" : "延迟"}</div>
        <div class="muted small" style="margin-top:6px">同步组件 ${esc(
          s.probe.slimSync
        )} · ${esc(s.probe.version || "")} · 心跳 ${esc(
          s.probe.lastHeartbeat || "—"
        )}</div>
      </div>
      <div class="dash-metrics dash-metrics-2">
        <div><span class="dash-k">今日进料</span><strong>${esc(
          st.todayUploaded || "—"
        )}</strong>${
          st.todayFiles != null
            ? `<span class="muted small"> · ${st.todayFiles} 个文件</span>`
            : ""
        }</div>
        <div><span class="dash-k">监视目录</span><strong>${
          dirs.length
        }</strong><span class="muted small"> 个</span></div>
      </div>
    </div>
    <div class="deal-section" id="dirs">
      <div class="toolbar" style="margin-top:18px">
        <h2 style="margin:0;flex:1">入库目录 · ${esc(s.host)}</h2>
        <button type="button" class="btn btn-primary" id="btn-add">添加目录</button>
      </div>
      <div id="list"></div>
    </div>`;

    const list = document.getElementById("list");
    if (!dirs.length) {
      list.innerHTML = `<div class="empty">还没有监视目录，点击「添加目录」。</div>`;
    } else {
      list.innerHTML = dirs
        .map(
          (d) => `<div class="card dir-row" style="margin-bottom:8px">
          <div class="deal-main">
            <div class="deal-title">${esc(d.path)}</div>
            <div class="deal-meta">
              <span class="pill ok">${esc(d.status || "监视中")}</span>
              <span class="muted">${d.files ?? 0} 文件 · ${esc(
                d.bytes || "—"
              )}</span>
            </div>
          </div>
          <button type="button" class="btn" data-del="${esc(d.id)}">删除</button>
        </div>`
        )
        .join("");
    }
    document.getElementById("btn-add").onclick = openAddDialog;
    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-del");
        const row = dirs.find((d) => d.id === id);
        const ok = await confirmDialog({
          title: "删除目录",
          body: `将停止监视「${row ? row.path : id}」，并从监视列表移除。`,
          confirmText: "删除",
        });
        if (!ok) return;
        await ingestRemoveDir(account, id, mid);
        tip("已从监视列表移除");
        paintManage();
      };
    });
  }

  /* —— 机器总览（IT） —— */
  async function paintFleet() {
    await paintMachineBar(false);
    if (account.role !== "it") {
      viewEl.innerHTML = `<div class="empty">无权限</div>`;
      return;
    }
    const { items } = await listIngestMachines(account);
    viewEl.innerHTML = `
    <p class="muted small" style="margin:0 0 10px">可点「代管」进入目标机的接入/入库管理（在操作台操作，事落目标机）。</p>
    <table class="table" id="tbl">
      <thead>
        <tr>
          <th>用户</th><th>机器</th><th>阶段</th><th>连接</th><th>同步组件</th><th>版本</th><th>最近见到</th><th></th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>`;
    document.querySelector("#tbl tbody").innerHTML = items
      .map((r) => {
        const pl = phaseLabel(r.phase);
        const ssh =
          r.sshd === "在线" ? "ok" : r.sshd === "离线" ? "danger" : "warn";
        const sync =
          r.probe?.slimSync === "在线"
            ? "ok"
            : r.probe?.slimSync === "延迟"
              ? "warn"
              : "danger";
        return `<tr>
        <td>${esc(r.ownerName)}${r.mine ? ' <span class="muted small">本人</span>' : ""}</td>
        <td>${esc(r.host)}</td>
        <td><span class="pill ${pl.cls}">${esc(pl.text)}</span></td>
        <td><span class="pill ${ssh}">${esc(r.sshd || "—")}</span></td>
        <td><span class="pill ${sync}">${esc(r.probe?.slimSync || "—")}</span></td>
        <td>${esc(r.probe?.version || "—")}</td>
        <td>${esc(r.probe?.lastHeartbeat || "—")}</td>
        <td><button type="button" class="btn" data-m="${esc(r.id)}">代管</button></td>
      </tr>`;
      })
      .join("");
    document.querySelectorAll("#tbl [data-m]").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-m");
        await setSelectedIngestMachine(account, id);
        currentMachineId = id;
        const m = items.find((x) => x.id === id);
        tip(`已选目标机「${m?.host || id}」`);
        switchView(m?.phase === "ready" ? "manage" : "setup", true, id);
      };
    });
  }

  /* —— 共享源（IT） —— */
  async function paintShared() {
    await paintMachineBar(false);
    if (account.role !== "it") {
      viewEl.innerHTML = `<div class="empty">无权限</div>`;
      return;
    }
    const { items } = await listSharedSources(account);
    if (!items.length) {
      viewEl.innerHTML = `<div class="empty">暂无共享源</div>`;
      return;
    }
    viewEl.innerHTML = items
      .map((s) => {
        const healthCls =
          s.health === "正常" ? "ok" : s.health === "延迟" ? "warn" : "danger";
        const paths = Array.isArray(s.paths) ? s.paths : [];
        return `<div class="card" style="margin-bottom:12px">
          <div class="toolbar" style="margin:0 0 8px">
            <div style="flex:1">
              <div class="deal-title">${esc(s.name)}</div>
              <div class="deal-meta">
                <span class="pill">${esc(s.type)}</span>
                <span class="pill ${healthCls}">${esc(s.health || s.status)}</span>
                <span class="muted">${esc(s.protocol)} · ${esc(s.endpoint)}</span>
                <span class="muted">最近 ${esc(s.lastSeen || "—")}</span>
              </div>
            </div>
          </div>
          <div class="muted small" style="margin-bottom:6px">监视路径（服务账号，非个人向导）</div>
          ${
            paths.length
              ? paths
                  .map(
                    (p) => `<div class="card dir-row" style="margin-bottom:6px;padding:10px 12px">
                <div class="deal-main">
                  <div class="deal-title" style="font-size:13px">${esc(p.path)}</div>
                  <div class="deal-meta">
                    <span class="pill ok">${esc(p.status || "监视中")}</span>
                    <span class="muted">${p.files ?? 0} 文件 · ${esc(
                      p.bytes || "—"
                    )}</span>
                  </div>
                </div>
              </div>`
                  )
                  .join("")
              : `<div class="empty">尚未登记路径</div>`
          }
        </div>`;
      })
      .join("");
  }

  async function paintView() {
    document.getElementById("modal-root").innerHTML = "";
    if (view === "upload") return paintUpload();
    if (view === "machines") return paintMachines();
    if (view === "setup") return paintSetup();
    if (view === "manage") return paintManage();
    if (view === "fleet") return paintFleet();
    if (view === "shared") return paintShared();
  }

  let view = url.searchParams.get("view") || mapLegacy() || "upload";
  if ((view === "fleet" || view === "shared") && account.role !== "it") {
    view = "upload";
    const u = new URL(location.href);
    u.searchParams.set("view", "upload");
    history.replaceState({}, "", u);
    url = u;
    const { refreshShellChrome } = await import("../shell.js?v=nav50");
    await refreshShellChrome(account, VIEWS.upload.key);
  }
  if (!VIEWS[view]) view = "upload";
  const preferMachine = url.searchParams.get("machine");
  if (preferMachine) {
    const ok = await setSelectedIngestMachine(account, preferMachine);
    if (ok.ok) currentMachineId = preferMachine;
  } else {
    currentMachineId = await getSelectedIngestMachineId(account);
  }

  document.title = `${VIEWS[view].title} · 文档入库`;
  root.querySelector("#title").textContent = VIEWS[view].title;
  root.querySelector("#sub").textContent = VIEWS[view].sub;
  await paintView();
}
