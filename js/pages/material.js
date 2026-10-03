import { getDeal } from "../api-mock.js?v=nav55";
import { esc } from "../esc.js?v=nav55";

export const roles = ["employee", "manager", "boss"];
export const active = "my-deals";
export const title = "材料";

export async function activate({ account, url, root }) {
  root.innerHTML = '<p class="muted small" id="back"></p>\n    <div class="page-head" id="head"></div>\n    <div class="card" id="body"></div>';
const q = new URLSearchParams(location.search);
const dealId = q.get("deal") || "";
const file = q.get("file") || "材料";
const seg = q.get("seg") || "";
const summary = q.get("summary") || "";
const from = q.get("from") || "mine";

document.getElementById("back").innerHTML = dealId
  ? `<a href="./aispace.html?view=deal&id=${esc(dealId)}&from=${esc(
      from
    )}">← 返回这一单</a>`
  : `<a href="./aispace.html?view=mine">← 我的单</a>`;

document.title = `${file} · 查阅`;
document.getElementById("head").innerHTML = `
  <h1>${esc(file)}</h1>
  <p>${seg ? `<span class="pill">${esc(seg)}</span>` : ""}${esc(summary || "材料预览")}</p>`;

let extra = "";
if (dealId) {
  const pack = await getDeal(dealId);
  if (pack) {
    const hit = pack.evidence.find((e) => e.file === file);
    if (hit) {
      extra = `<p class="small">所属跟单：<a href="./aispace.html?view=deal&id=${esc(
        dealId
      )}&from=${esc(from)}">${esc(pack.deal.name)}</a></p>
      <p class="small muted">摘录：${esc(hit.summary)}</p>`;
    }
  }
}

document.getElementById("body").innerHTML = `
  <div class="muted small" style="margin-bottom:8px">文件预览</div>
  <pre style="margin:0;white-space:pre-wrap;font-family:var(--font-mono);font-size:12px;line-height:1.5">【${esc(
    file
  )}】
${seg ? "段落：" + esc(seg) + "\n" : ""}${esc(
  summary || "（无摘要）"
)}

—— 以上为入库摘录；点击返回可继续就这一单提问。</pre>
  ${extra}`;
}
