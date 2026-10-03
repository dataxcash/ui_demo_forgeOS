import {
  getAiTool,
  getAiTools,
  runAiTool,
  getAiToolRuns,
} from "../api-mock.js?v=nav57";
import { esc } from "../esc.js?v=nav57";

export const roles = ["employee", "manager", "boss", "hr", "it"];
export const title = "ai工具";

const ACTIVE = {
  ocr: "ai-ocr",
  asr: "ai-asr",
  tts: "ai-tts",
  content: "ai-content",
};

export function activeKey(url) {
  const id = url.searchParams.get("id") || "ocr";
  return ACTIVE[id] || "ai-ocr";
}

export async function activate({ account, url, root }) {
  root.innerHTML = `
    <div class="flash" id="flash"></div>
    <div class="page-head">
      <h1 id="title">—</h1>
      <p id="sub"></p>
    </div>
    <div class="tool-work" id="work"></div>
    <details class="tool-hist" id="hist-wrap" hidden>
      <summary>最近几次</summary>
      <div id="hist"></div>
    </details>`;
  const work = root.querySelector("#work");
  const catalog = await getAiTools();
  let toolId = url.searchParams.get("id") || "ocr";
  if (!catalog.some((t) => t.id === toolId)) toolId = "ocr";
  let tool = catalog.find((t) => t.id === toolId);
  /** @type {File[]} */
  let files = [];
  /** @type {object|null} */
  let current = null;


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

function speak(text) {
  if (!text || !window.speechSynthesis) {
    tip("本机暂不能朗读，请换浏览器或装语音包后再试");
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  window.speechSynthesis.speak(u);
}

function stopSpeak() {
  window.speechSynthesis?.cancel();
}

function renderResultHtml(job) {
  if (!job) {
    return `<div class="tool-result-empty muted">还没有结果</div>`;
  }
  if (job.toolId === "content" && (job.points || job.risks)) {
    const head = (job.inputSummary || "").slice(0, 40);
    return `
      <p class="muted small" style="margin:0 0 10px">依据你提交的片段${
        head
          ? `（开头：「${esc(head)}${
              job.inputSummary.length > 40 ? "…" : ""
            }」）`
          : ""
      }</p>
      <div class="tool-block">
        <div class="dash-k">要点</div>
        <ol class="tool-points">
          ${(job.points || []).map((p) => `<li>${esc(p)}</li>`).join("")}
        </ol>
      </div>
      ${
        job.risks?.length
          ? `<div class="tool-block tool-risk">
              <div class="dash-k">风险提示</div>
              <ul class="tool-points">
                ${job.risks.map((r) => `<li>${esc(r)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }`;
  }
  if (job.toolId === "tts") {
    return `
      <div class="tool-block">
        <pre class="tool-result">${esc(job.speakText || job.result)}</pre>
        <div class="actions" style="margin-top:10px">
          <button type="button" class="btn btn-primary" id="btn-play">播放</button>
          <button type="button" class="btn" id="btn-stop">停止</button>
        </div>
      </div>`;
  }
  return `<pre class="tool-result">${esc(job.result)}</pre>`;
}

function paintResultPane() {
  const pane = document.getElementById("result-pane");
  if (!pane) return;
  const isTts = tool.id === "tts";
  const headAction = isTts
    ? `<button type="button" class="btn btn-primary" id="btn-head-play" ${
        current ? "" : "disabled"
      }>播放</button>`
    : `<button type="button" class="btn" id="btn-copy" ${
        current ? "" : "disabled"
      }>复制</button>`;
  pane.innerHTML = `
    <div class="tool-pane-head">
      <span class="dash-k">结果</span>
      ${headAction}
    </div>
    <div class="tool-pane-body" id="result-body">
      ${renderResultHtml(current)}
    </div>`;
  document.getElementById("btn-copy")?.addEventListener("click", async () => {
    if (!current?.result) return;
    try {
      await navigator.clipboard.writeText(current.result);
      tip("已复制");
    } catch {
      tip("复制失败，请手动选中");
    }
  });
  const play = () => speak(current?.speakText || current?.result || "");
  document.getElementById("btn-head-play")?.addEventListener("click", play);
  document.getElementById("btn-play")?.addEventListener("click", play);
  document.getElementById("btn-stop")?.addEventListener("click", stopSpeak);
}

async function paintHist() {
  const { items } = await getAiToolRuns(tool.id);
  const wrap = document.getElementById("hist-wrap");
  const box = document.getElementById("hist");
  if (!items.length) {
    wrap.hidden = true;
    wrap.open = false;
    box.innerHTML = "";
    return;
  }
  wrap.hidden = false;
  box.innerHTML = items
    .slice(0, 6)
    .map(
      (j) => `<button type="button" class="tool-hist-item" data-id="${esc(
        j.id
      )}">
        <strong>${esc(j.at)}</strong>
        <span class="muted small">${esc(j.inputSummary)}</span>
      </button>`
    )
    .join("");
  box.querySelectorAll("[data-id]").forEach((btn) => {
    btn.onclick = () => {
      current = items.find((x) => x.id === btn.getAttribute("data-id"));
      paintResultPane();
    };
  });
}

async function doRun(payload) {
  const btn = document.getElementById("btn-run");
  if (btn) btn.disabled = true;
  const res = await runAiTool(account, tool.id, payload);
  if (btn) btn.disabled = false;
  if (!res.ok) {
    tip(res.error || "失败");
    return;
  }
  current = res.job;
  paintResultPane();
  await paintHist();
  if (tool.id === "tts") speak(current.speakText);
}

function paintWork() {
  files = [];
  current = null;
  stopSpeak();
  document.title = `${tool.name} · ai工具`;
  document.getElementById("title").textContent = tool.name;
  document.getElementById("sub").textContent = tool.desc || "";

  const inputInner =
    tool.input === "file"
      ? `
        <div class="upload-drop" id="drop">
          <input type="file" id="file-input" accept="${esc(
            tool.accept || "*/*"
          )}" multiple hidden />
          <p style="margin:0 0 10px">${esc(tool.dropHint || "拖到这里，或")}</p>
          <button type="button" class="btn btn-primary" id="btn-pick">选择文件</button>
        </div>
        <div id="picked" class="upload-picked muted small" hidden></div>
        <div class="actions" style="margin-top:12px">
          <button type="button" class="btn" id="btn-clear" disabled>清空</button>
          <button type="button" class="btn btn-primary" id="btn-run" disabled>${esc(
            tool.action || "开始"
          )}</button>
        </div>`
      : `
        <textarea id="txt" rows="10" class="tool-textarea" placeholder="${esc(
          tool.placeholder || ""
        )}"></textarea>
        <div class="actions" style="margin-top:12px">
          <button type="button" class="btn btn-primary" id="btn-run">${esc(
            tool.action || "开始"
          )}</button>
        </div>`;

  work.innerHTML = `
    <section class="tool-pane">
      <div class="tool-pane-head"><span class="dash-k">放进来</span></div>
      <div class="tool-pane-body">${inputInner}</div>
    </section>
    <section class="tool-pane" id="result-pane"></section>`;

  paintResultPane();

  if (tool.input === "file") {
    const input = document.getElementById("file-input");
    const drop = document.getElementById("drop");
    const pickedEl = document.getElementById("picked");
    const btnPick = document.getElementById("btn-pick");
    const btnClear = document.getElementById("btn-clear");
    const btnRun = document.getElementById("btn-run");

    function paintPicked() {
      const on = files.length > 0;
      btnClear.disabled = !on;
      btnRun.disabled = !on;
      if (!on) {
        pickedEl.hidden = true;
        pickedEl.innerHTML = "";
        return;
      }
      pickedEl.hidden = false;
      pickedEl.innerHTML =
        `已选 ${files.length} 个` +
        `<ul style="margin:4px 0 0;padding-left:18px">` +
        files
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
      const next = [...files];
      for (const f of list) {
        if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
        next.push(f);
      }
      files = next;
      paintPicked();
    }

    btnPick.onclick = () => input.click();
    input.onchange = () => {
      addFiles([...input.files]);
      input.value = "";
    };
    btnClear.onclick = () => {
      files = [];
      paintPicked();
    };
    btnRun.onclick = () =>
      doRun({
        files: files.map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
        })),
      }).then(() => {
        files = [];
        paintPicked();
      });
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
  } else {
    document.getElementById("btn-run").onclick = async () => {
      const text = document.getElementById("txt").value;
      await doRun({ text });
      document.getElementById("txt").value = "";
    };
  }
}

async function switchTool(id, pushUrl) {
  const { softNavigate } = await import("../soft-nav.js?v=nav57");
  await softNavigate(new URL(`./ai-tool.html?id=${id}`, location.href), { push: !!pushUrl });
}



  paintWork();
  await paintHist();
}
