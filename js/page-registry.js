/**
 * 页面注册表：路径 → 动态模块。
 * 未登记的 .html 仍走整页跳转（如 login）。
 */
const V = "nav48";

function page(path) {
  return () => import(`${path}?v=${V}`);
}

/** @type {Record<string, () => Promise<any>>} */
export const PAGE_LOADERS = {
  "aispace.html": page("./pages/aispace.js"),
  "ingest.html": page("./pages/ingest.js"),
  "ai-tool.html": page("./pages/ai-tool.js"),
  "ai-tools.html": page("./pages/ai-tool.js"),
  "hr-org.html": page("./pages/hr-org.js"),
  "hr-home.html": page("./pages/hr-org.js"),
  "hr-import.html": page("./pages/hr-org.js"),
  "boss-home.html": page("./pages/boss-home.js"),
  "it-home.html": page("./pages/it-home.js"),
  "it-job.html": page("./pages/it-home.js"),
  "material.html": page("./pages/material.js"),
  "me.html": page("./pages/me.js"),
  "graph.html": page("./pages/graph.js"),
  "graph-theme.html": page("./pages/graph-theme.js"),
  "graph-candidates.html": page("./pages/graph-candidates.js"),
  "search.html": page("./pages/search.js"),
  "compliance-stub.html": page("./pages/stub.js"),
  "no-access.html": page("./pages/stub.js"),
};

/** 旧地址 → 规范页 + 默认查询参数 */
const ALIASES = {
  "my-deals.html": { key: "aispace.html", view: "mine" },
  "team-deals.html": { key: "aispace.html", view: "team" },
  "deal.html": { key: "aispace.html", view: "deal" },
  "done-deals.html": { key: "aispace.html", view: "done" },
  "ask.html": { key: "aispace.html", view: "mine" },
  "ingest-upload.html": { key: "ingest.html", view: "upload" },
  "ingest-setup.html": { key: "ingest.html", view: "setup" },
  "ingest-machines.html": { key: "ingest.html", view: "machines" },
  "ingest-shared.html": { key: "ingest.html", view: "shared" },
  "sync-status.html": { key: "ingest.html", view: "manage" },
  "ingest-fleet.html": { key: "ingest.html", view: "fleet" },
  "ingest-dirs.html": { key: "ingest.html", view: "manage" },
  "sync-settings.html": { key: "ingest.html", view: "manage" },
  "hr-home.html": { key: "hr-org.html", view: "tasks" },
  "hr-import.html": { key: "hr-org.html", view: "upload" },
  "it-job.html": { key: "it-home.html", view: "services" },
};

/** 把旧 URL 规范成注册表主地址（保留其余 query） */
export function canonicalizeUrl(url) {
  const u = typeof url === "string" ? new URL(url, location.href) : new URL(url.href);
  const name = u.pathname.split("/").pop() || "";
  const alias = ALIASES[name];
  if (!alias) return u;
  const next = new URL(`./${alias.key}`, u.href);
  u.searchParams.forEach((v, k) => next.searchParams.set(k, v));
  if (alias.view && !next.searchParams.get("view")) {
    next.searchParams.set("view", alias.view);
  }
  return next;
}

export function resolvePageLoader(url) {
  const canon = canonicalizeUrl(url);
  const key = canon.pathname.split("/").pop() || "";
  const load = PAGE_LOADERS[key];
  if (!load) return null;
  return { key, load, name: (typeof url === "string" ? new URL(url, location.href) : url).pathname.split("/").pop() || "", canon };
}
