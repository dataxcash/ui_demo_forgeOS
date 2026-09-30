import { esc } from "./esc.js";

export function confirmDialog({ title, body, confirmText = "确认", danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop show";
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2>${esc(title)}</h2>
        <p class="muted small">${esc(body)}</p>
        <div class="actions">
          <button type="button" class="btn" data-act="cancel">取消</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e) => {
      const act = e.target.getAttribute?.("data-act");
      if (!act && e.target !== backdrop) return;
      if (act === "ok") {
        backdrop.remove();
        resolve(true);
      } else if (act === "cancel" || e.target === backdrop) {
        backdrop.remove();
        resolve(false);
      }
    });
  });
}
