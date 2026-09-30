const STATE_KEY = "fos-demo-state-v1";

function readState() {
  try {
    return JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeState(state) {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`mock ${path} ${res.status}`);
  return res.json();
}

function delay(ms = 120) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getCandidates() {
  await delay();
  const base = await loadJson("../mock/graph/candidates.json");
  const st = readState();
  const removed = new Set(st.confirmedCandidateIds || []);
  const rejected = new Set(st.rejectedCandidateIds || []);
  return base.filter((c) => !removed.has(c.id) && !rejected.has(c.id));
}

export async function confirmCandidates(ids) {
  await delay(180);
  const st = readState();
  st.confirmedCandidateIds = [
    ...new Set([...(st.confirmedCandidateIds || []), ...ids]),
  ];
  st.confirmedAt = Date.now();
  // promote into team board overlay
  const base = await loadJson("../mock/graph/candidates.json");
  const picked = base.filter((c) => ids.includes(c.id));
  st.extraTeamThemes = [...(st.extraTeamThemes || []), ...picked.map((c) => ({
    id: c.id,
    name: c.name,
    owner: c.suggestedOwner,
    status: "进行中",
    type: c.type,
  }))];
  writeState(st);
  return { ok: true, count: ids.length };
}

export async function rejectCandidates(ids) {
  await delay(120);
  const st = readState();
  st.rejectedCandidateIds = [
    ...new Set([...(st.rejectedCandidateIds || []), ...ids]),
  ];
  writeState(st);
  return { ok: true };
}

export async function getImportBatch() {
  await delay();
  const base = await loadJson("../mock/hr/import-batch.json");
  const st = readState();
  if (st.importConfirmed) {
    return { ...base, rows: [], confirmed: st.importResult };
  }
  const overrides = st.importOverrides || {};
  const removed = new Set(st.importRemoved || []);
  const rows = base.rows
    .filter((r) => !removed.has(r.id))
    .map((r) => ({ ...r, ...(overrides[r.id] || {}) }));
  return { ...base, rows, confirmed: null };
}

export async function patchImportRow(id, patch) {
  const st = readState();
  st.importOverrides = st.importOverrides || {};
  st.importOverrides[id] = { ...(st.importOverrides[id] || {}), ...patch };
  writeState(st);
}

export async function removeImportRow(id) {
  const st = readState();
  st.importRemoved = [...new Set([...(st.importRemoved || []), id])];
  writeState(st);
}

export async function confirmImport(selectedIds) {
  await delay(200);
  const batch = await getImportBatch();
  const n = batch.rows.filter((r) => selectedIds.includes(r.id)).length;
  const st = readState();
  st.importConfirmed = true;
  st.importResult = { opened: n, at: Date.now() };
  writeState(st);
  return st.importResult;
}

export async function getDeals() {
  await delay();
  return loadJson("../mock/deals/deals.json");
}

/** openOnly 默认 true：我的单只看未完成 */
export async function getMyDeals(account, { scope = "mine", openOnly = true } = {}) {
  await delay();
  let list = await getDeals();
  if (openOnly) list = list.filter((d) => d.open);
  else list = list.filter((d) => !d.open);

  if (scope === "mine") {
    list = list.filter((d) => d.owner === account.name);
  }
  // team：组里未完成（经理）；演示数据不过滤到部门树，直接全量未完成
  list = [...list].sort((a, b) => b.priority - a.priority);
  return list;
}

export async function getDeal(id) {
  await delay();
  const deals = await getDeals();
  const deal = deals.find((d) => d.id === id);
  if (!deal) return null;
  const timeline = (await loadJson("../mock/graph/timeline.json")).filter(
    (e) => e.themeId === id
  );
  const evidence = (await loadJson("../mock/graph/evidence.json")).filter(
    (e) => e.themeId === id
  );
  return { deal, timeline, evidence };
}

export async function askDeal(id, question) {
  await delay(220);
  const pack = await getDeal(id);
  if (!pack) {
    return { answer: "找不到这一单。", citations: [], next: "" };
  }
  const { deal, evidence, timeline } = pack;
  const q = (question || "").trim();
  const toCite = (e) => ({
    file: e.file,
    seg: e.seg || "",
    summary: e.summary || "",
    href: `./material.html?deal=${encodeURIComponent(id)}&file=${encodeURIComponent(
      e.file
    )}&seg=${encodeURIComponent(e.seg || "")}&summary=${encodeURIComponent(
      e.summary || ""
    )}`,
  });
  const cites = evidence.slice(0, 2).map(toCite);
  const latest = [...timeline].sort((a, b) => (a.when < b.when ? 1 : -1))[0];

  if (!q) {
    return { answer: "请先输入问题。", citations: [], next: "" };
  }

  // 1 现在怎样 / 卡在哪
  if (/卡|进度|怎样|怎么了|状态|现在/.test(q)) {
    return {
      answer: `状态：${deal.status}。${deal.summary}${
        latest ? ` 最近进展（${latest.when}）：${latest.text}。` : ""
      }`,
      next: `建议动作：针对「${deal.why}」推进；阶段/金额仍以 CRM 为准。`,
      citations: cites,
    };
  }

  // 2 口径 / 说过什么
  if (/答应|说过|OPC|依据|口径|承诺/.test(q)) {
    const hit = evidence.find((e) =>
      /OPC|承诺|要求|纪要|金额|差|签章|停工/.test(
        `${e.summary}${e.seg}${e.file}`
      )
    );
    if (hit) {
      return {
        answer: `材料可对上：${hit.summary}。`,
        next: "对外说话请引用该出处；若与 CRM 字段不一致，先对内对齐再答复客户。",
        citations: [toCite(hit)],
      };
    }
    return {
      answer: `已入库材料里，暂未找到与「${q}」直接对应的表述。`,
      next: "建议补纪要/邮件入库后再问；不要凭记忆对外承诺。",
      citations: cites,
    };
  }

  // 3 下一步 / 该催什么
  if (/催|今天|该|下一步|优先|怎么推进/.test(q)) {
    return {
      answer: `这一单优先盯：${deal.why}（分桶：${deal.bucket}${
        deal.ruleHit ? `；入桶依据：${deal.ruleHit}` : ""
      }）。`,
      next: "具体改 CRM 阶段/金额请回 CRM；这里只帮你看清该催哪一环。",
      citations: cites,
    };
  }

  // 4 缺什么材料
  if (/缺|材料|补件|扫描|附件/.test(q)) {
    const gaps = evidence.filter((e) =>
      /缺|空|未到|扫描|补件|差/.test(`${e.summary}${e.seg}${e.file}`)
    );
    if (gaps.length) {
      return {
        answer: `从已挂材料看，缺口相关：${gaps
          .map((g) => `${g.file}（${g.summary}）`)
          .join("；")}。`,
        next: "催补时请点开出处核对原文，避免催错版本。",
        citations: gaps.map(toCite),
      };
    }
    if (evidence.length) {
      return {
        answer: `当前已关联 ${evidence.length} 份材料，未见明确「缺件」标记；仍以法务/客户最新要求为准。`,
        next: "若你知道还缺哪份，可入库后再问。",
        citations: cites,
      };
    }
    return {
      answer: "这一单还没有关联材料。",
      next: "先走「文档入库」补料，再回来问缺口。",
      citations: [],
    };
  }

  // 5 找谁 / 负责人
  if (/谁|负责|找谁|交接/.test(q)) {
    return {
      answer: `业务负责人：${deal.owner}。当前状态 ${deal.status}；卡点摘要：${deal.why}。`,
      next: "组织汇报线以人事组织为准；CRM 负责人和这里不一致时，以 CRM + 组织目录核对。",
      citations: cites,
    };
  }

  return {
    answer: `就「${deal.name}」：${deal.summary}（材料没有的不会编。）`,
    next: "可换一种问法：现在怎样 / 口径依据 / 该催什么 / 缺什么材料 / 找谁。",
    citations: cites,
  };
}

export async function getAiTools() {
  await delay();
  return loadJson("../mock/aitools/catalog.json");
}

/** 文档入库：基线 mock + session 向导进度 */
export async function getIngestState() {
  await delay();
  const base = await loadJson("../mock/ingest/state.json");
  const st = readState();
  const ing = st.ingest || {};
  const bootstrapInstalled = !!ing.bootstrapInstalled;
  const adminDone = !!ing.adminDone;
  const probeReady = !!ing.probeReady;
  let phase = "need_bootstrap";
  if (bootstrapInstalled && !adminDone) phase = "need_admin";
  if (bootstrapInstalled && adminDone && !probeReady) phase = "provisioning";
  if (bootstrapInstalled && adminDone && probeReady) phase = "ready";

  return {
    ...base,
    phase,
    bootstrap: {
      ...base.bootstrap,
      installed: bootstrapInstalled,
      lastSeen: bootstrapInstalled
        ? ing.bootstrapSeen || "2026-09-30 18:00"
        : null,
    },
    adminAuth: {
      ...base.adminAuth,
      done: adminDone,
    },
    syncAccount: {
      ...base.syncAccount,
      created: adminDone || probeReady,
    },
    probe: probeReady
      ? {
          slimSync: "在线",
          version: "0.9.2-win",
          lastHeartbeat: ing.probeSeen || "2026-09-30 18:05",
        }
      : adminDone
        ? {
            slimSync: "安装中",
            version: null,
            lastHeartbeat: null,
          }
        : base.probe,
    dirs: ing.dirs || base.dirs,
  };
}

export async function ingestMarkBootstrapInstalled() {
  const st = readState();
  st.ingest = {
    ...(st.ingest || {}),
    bootstrapInstalled: true,
    bootstrapSeen: new Date().toISOString().slice(0, 16).replace("T", " "),
  };
  writeState(st);
  return getIngestState();
}

export async function ingestSubmitAdmin(_user, _pass) {
  await delay(400);
  const st = readState();
  st.ingest = {
    ...(st.ingest || {}),
    bootstrapInstalled: true,
    adminDone: true,
    probeReady: false,
  };
  writeState(st);
  // 演示：短暂「安装中」后由页面再点「刷新探针」就绪
  return getIngestState();
}

export async function ingestMarkProbeReady() {
  const st = readState();
  st.ingest = {
    ...(st.ingest || {}),
    bootstrapInstalled: true,
    adminDone: true,
    probeReady: true,
    probeSeen: new Date().toISOString().slice(0, 16).replace("T", " "),
  };
  writeState(st);
  return getIngestState();
}

/** 本机目录浏览（演示：模拟探针侧列目录） */
export async function browseIngestFs(path) {
  await delay(80);
  const tree = await loadJson("../mock/ingest/fs-tree.json");
  const raw = (path || "").trim();
  if (!raw || raw === "\\") {
    return {
      path: "",
      parent: null,
      entries: tree.drives.map((d) => ({
        name: d.name,
        path: d.path,
        kind: "drive",
      })),
    };
  }
  let cur = raw.replace(/\//g, "\\");
  if (!cur.endsWith("\\")) cur += "\\";
  const names = tree.dirs[cur];
  if (!names) {
    return { path: cur, parent: parentPath(cur), entries: [], error: "无法打开此目录" };
  }
  return {
    path: cur,
    parent: parentPath(cur),
    entries: names.map((name) => ({
      name,
      path: cur + name + "\\",
      kind: "dir",
    })),
  };
}

function parentPath(p) {
  if (!p) return null;
  const norm = p.endsWith("\\") ? p.slice(0, -1) : p;
  const i = norm.lastIndexOf("\\");
  if (i <= 0) return "";
  if (i === 1 || /^[A-Za-z]:$/.test(norm.slice(0, i))) return norm.slice(0, 2) + "\\";
  return norm.slice(0, i + 1);
}

export async function ingestAddDir(path) {
  const res = await ingestAddDirs([path]);
  if (!res.ok) return res;
  return { ok: true, dirs: res.dirs, added: res.added };
}

/** 批量加入监视目录 */
export async function ingestAddDirs(paths) {
  await delay(180);
  const st = readState();
  const cur = await getIngestState();
  const dirs = [...(cur.dirs || [])];
  const existing = new Set(dirs.map((d) => d.path));
  const added = [];
  const skipped = [];
  for (const raw of paths || []) {
    let p = String(raw || "")
      .trim()
      .replace(/\//g, "\\");
    if (!p) continue;
    if (p.endsWith("\\") && !/^[A-Za-z]:\\$/.test(p)) p = p.slice(0, -1);
    if (existing.has(p)) {
      skipped.push(p);
      continue;
    }
    existing.add(p);
    const row = {
      id: "d" + Date.now() + "-" + added.length,
      path: p,
      files: 0,
      bytes: "—",
      status: "监视中",
    };
    dirs.push(row);
    added.push(row);
  }
  if (!added.length) {
    return {
      ok: false,
      error: skipped.length ? "所选目录已在列表中" : "请先选择目录",
      skipped,
    };
  }
  st.ingest = { ...(st.ingest || {}), dirs };
  writeState(st);
  return { ok: true, dirs, added, skipped };
}

export async function ingestRemoveDir(id) {
  await delay(120);
  const st = readState();
  const cur = await getIngestState();
  const dirs = (cur.dirs || []).filter((d) => d.id !== id);
  st.ingest = { ...(st.ingest || {}), dirs };
  writeState(st);
  return { ok: true, dirs };
}

/** 文件入库：Web 直传后台 → slimRAG（不经 slimSync） */
export async function uploadIngestFiles(account, files) {
  await delay(420);
  const list = Array.isArray(files) ? files : [];
  if (!list.length) return { ok: false, error: "请先选择文件" };
  const st = readState();
  const batch = {
    id: "up-" + Date.now(),
    at: new Date().toISOString().slice(0, 16).replace("T", " "),
    userId: account?.id || "",
    userName: account?.name || "",
    role: account?.role || "",
    files: list.map((f) => ({
      name: f.name,
      size: f.size || 0,
      type: f.type || "",
    })),
    route: "slimRAG",
    via: "upload",
  };
  const hist = [...(st.ingestUploads || [])];
  hist.unshift(batch);
  st.ingestUploads = hist.slice(0, 20);
  writeState(st);
  return { ok: true, batch, accepted: list.length };
}

export async function getIngestUploads() {
  await delay(60);
  const st = readState();
  return { items: st.ingestUploads || [] };
}

export async function getStatus(account) {
  await delay(80);
  const items = [];
  if (account.role === "manager" || account.role === "employee") {
    const mine = await getMyDeals(account, { scope: "mine", openOnly: true });
    const urgent = mine.filter((d) => d.bucket === "须尽快");
    if (urgent.length) {
      items.push({
        text: `${urgent.length} 单须尽快处理`,
        href: "./my-deals.html?f=urgent",
      });
    }
  }
  if (account.role === "hr") {
    const batch = await getImportBatch();
    if (!batch.confirmed && batch.rows.length) {
      items.push({
        text: `待确认导入 ${batch.rows.length} 人`,
        href: "./hr-import.html",
      });
    } else if (batch.confirmed) {
      items.push({
        text: `已开通 ${batch.confirmed.opened} 人（本会话）`,
        href: "./hr-import.html",
      });
    }
  }
  if (account.role === "it") {
    const jobs = await loadJson("../mock/it/jobs-a.json");
    const failed = jobs.filter((j) => j.status === "失败");
    if (failed.length) {
      items.push({
        text: `批炼失败 ${failed.length} 条`,
        href: "./it-job.html",
      });
    }
  }
  if (account.role === "boss") {
    const risks = await loadJson("../mock/boss/risks.json");
    const hot = risks.filter((r) => r.level === "高");
    if (hot.length) {
      items.push({
        text: `${hot.length} 处经营风险待灭火`,
        href: "./boss-home.html#risks",
      });
    }
  }
  return items;
}

export async function getThemes() {
  await delay();
  return loadJson("../mock/graph/themes.json");
}

export async function getTheme(id) {
  await delay();
  const themes = await loadJson("../mock/graph/themes.json");
  const theme = themes.find((t) => t.id === id);
  const relations = await loadJson("../mock/graph/relations.json");
  const timeline = await loadJson("../mock/graph/timeline.json");
  const evidence = await loadJson("../mock/graph/evidence.json");
  return {
    theme,
    relations: relations.filter((r) => r.themeId === id),
    timeline: timeline.filter((e) => e.themeId === id),
    evidence: evidence.filter((e) => e.themeId === id),
  };
}

export async function getTeamBoard() {
  await delay();
  const base = await loadJson("../mock/graph/team-board.json");
  const st = readState();
  const extra = st.extraTeamThemes || [];
  return {
    ...base,
    themes: [...base.themes, ...extra],
  };
}

export async function getAskThreads() {
  await delay();
  return loadJson("../mock/ask/threads.json");
}

export async function getSearchHits(q) {
  await delay();
  const hits = await loadJson("../mock/search/hits.json");
  if (!q) return hits;
  const s = q.toLowerCase();
  return hits.filter(
    (h) =>
      h.title.toLowerCase().includes(s) ||
      h.snippet.toLowerCase().includes(s)
  );
}

export async function getBoss() {
  await delay();
  return {
    operating: await loadJson("../mock/boss/operating.json"),
    risks: await loadJson("../mock/boss/risks.json"),
  };
}

export async function getIt() {
  await delay();
  return {
    layers: await loadJson("../mock/it/layers.json"),
    jobs: await loadJson("../mock/it/jobs-a.json"),
  };
}

export async function getCopilot(role) {
  const all = await loadJson("../mock/copilot/suggestions.json");
  return all.filter((s) => s.roles.includes(role));
}

/** 对话助理：按 ROLE + 问题关键词返回答复（Mock） */
export async function askCopilot({ account, question, pageKey }) {
  await delay(220);
  const q = (question || "").trim();
  const role = account.role;
  const lower = q.toLowerCase();

  const cite = (lines) => lines.join("\n");

  if (!q) {
    return { text: "请输入具体问题。", actions: [] };
  }

  if (role === "hr" || /导入|开通|确认板|入职/.test(q)) {
    const batch = await getImportBatch();
    if (batch.confirmed) {
      return {
        text: cite([
          `本会话已确认开通 ${batch.confirmed.opened} 人。`,
          "未确认的导入批次不会进入可用账户。若需新批次，请重新导入（本预发环境可清会话后重试）。",
        ]),
        actions: [{ id: "go-import", label: "打开导入确认", href: "./hr-import.html" }],
      };
    }
    return {
      text: cite([
        `当前待确认导入 ${batch.rows.length} 人（批次 ${batch.batchId}，源 ${batch.source}）。`,
        "色标含：正常 / 疑似重复 / 缺上级 / 冲突部门。",
        "我可以建议勾选「正常」行，但开通必须由你在确认板点击总确认。",
      ]),
      actions: [
        { id: "prefill-normal", label: "建议勾选正常行", kind: "hr-prefill" },
        { id: "go-import", label: "打开导入确认", href: "./hr-import.html" },
      ],
    };
  }

  if (role === "manager" || role === "employee") {
    if (/候选|待确认|入库/.test(q)) {
      const cands = await getCandidates();
      return {
        text: cite([
          `主题待确认 ${cands.length} 条。`,
          "点选后确认入库会进入团队墙；驳回则本会话不再显示。",
          "批炼入库由闲时 AI 自确认；此处是需经理裁定的候选。",
        ]),
        actions: [
          { id: "go-cand", label: "打开主题确认", href: "./graph-candidates.html" },
        ],
      };
    }
    if (/合同|法务|制氧|卡/.test(q)) {
      return {
        text: cite([
          "华东制氧厂 · MES：报价与框架协议卡在法务。",
          "要点：草案缺签章页；报价与草案差额 8.6 万。",
          "负责人：李娜。可打开主题查看关系与进程。",
        ]),
        actions: [
          { id: "go-theme", label: "打开主题 T-041", href: "./graph-theme.html?id=T-041" },
        ],
      };
    }
    if (/团队|下属|停滞/.test(q)) {
      return {
        text: cite([
          "团队切片可见下属权限内主题与停滞，不可见下属私域问答与未共享材料。",
          "建议在关系图谱切换「团队」查看墙面。",
        ]),
        actions: [{ id: "go-graph", label: "打开关系图谱", href: "./graph.html" }],
      };
    }
    return {
      text: cite([
        `已收到：${q}`,
        pageKey ? `当前页面上下文：${pageKey}` : "",
        "可再问：合同卡点、团队停滞、主题待确认。或直接使用左侧「问 / 搜 / 关系图谱」。",
      ].filter(Boolean)),
      actions: [{ id: "go-ask", label: "去「问」", href: "./ask.html" }],
    };
  }

  if (role === "boss") {
    const { risks, operating } = await getBoss();
    const hot = risks.filter((r) => r.level === "高");
    return {
      text: cite([
        `经营信号：在谈 ${operating.talking.count} · 将落袋 ${operating.closing.count} · 可能走样 ${operating.drift.count}。`,
        `高风险 ${hot.length} 项：${hot.map((r) => r.title).join("；") || "无"}。`,
        "灭火看摘要与负责人即可，无需亲自清矿。",
      ]),
      actions: [{ id: "go-boss", label: "经营与风险", href: "./boss-home.html" }],
    };
  }

  if (role === "it") {
    const { jobs } = await getIt();
    const failed = jobs.filter((j) => j.status === "失败");
    return {
      text: cite([
        `批炼任务 A：失败 ${failed.length}，跑中 ${jobs.filter((j) => j.status === "跑中").length}。`,
        failed.length ? `失败任务：${failed.map((j) => j.id + " " + j.name).join("；")}` : "当前无失败任务。",
        "资源向 Token A；经营账 B 不在本工作区。",
      ]),
      actions: [{ id: "go-job", label: "批炼任务", href: "./it-job.html" }],
    };
  }

  return {
    text: `已记录问题「${q}」。当前 ROLE 下请使用左侧导航进入对应工作区后再问具体事项。`,
    actions: [],
  };
}

export function resetDemoState() {
  sessionStorage.removeItem(STATE_KEY);
}
