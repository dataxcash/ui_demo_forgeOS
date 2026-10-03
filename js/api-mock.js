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

/** 花名册对比后的待办（确认生效 / 删除存档；有待办则禁止上传新表） */
export async function getOrgDiffTasks() {
  await delay();
  const base = await loadJson("../mock/hr/org-diff-tasks.json");
  const st = readState();
  const done = new Set(st.orgTaskDone || []);
  const archived = new Set(st.orgTaskArchived || []);
  const tasks = base.tasks.map((t) => {
    if (done.has(t.id)) return { ...t, status: "done" };
    if (archived.has(t.id)) return { ...t, status: "archived" };
    return { ...t, status: "pending" };
  });
  const pending = tasks.filter((t) => t.status === "pending");
  const summary = {
    join: pending.filter((t) => t.kind === "入").length,
    move: pending.filter((t) => t.kind === "转").length,
    leave: pending.filter((t) => t.kind === "离").length,
    adjust: pending.filter((t) => t.kind === "调").length,
  };
  return {
    ...base,
    tasks,
    summary,
    pendingCount: pending.length,
    canUpload: pending.length === 0,
    uploaded: !!st.orgCsvUploaded,
    lastUploadName: st.orgCsvName || base.sourceFile,
    archiveLog: st.orgArchiveLog || [],
  };
}

export async function uploadOrgCsv(fileName) {
  await delay(280);
  const pack = await getOrgDiffTasks();
  if (pack.pendingCount > 0) {
    return {
      ok: false,
      pendingCount: pack.pendingCount,
      message: `还有 ${pack.pendingCount} 条待办没处理完，不能传新花名册。请先确认或删除并存档。`,
    };
  }
  const st = readState();
  st.orgCsvUploaded = true;
  st.orgCsvName = fileName || "org-upload.csv";
  st.orgCsvAt = Date.now();
  /* 新一轮对比：清空本轮确认/存档标记，按样例重新列出待办 */
  st.orgTaskDone = [];
  st.orgTaskArchived = [];
  writeState(st);
  const next = await getOrgDiffTasks();
  return { ok: true, ...next };
}

export async function getHandover(id) {
  await delay(80);
  if (!id) return null;
  const all = await loadJson("../mock/hr/handovers.json");
  return all[id] || null;
}

export async function confirmOrgTasks(ids) {
  await delay(220);
  const st = readState();
  const archived = new Set(st.orgTaskArchived || []);
  const clean = ids.filter((id) => !archived.has(id));
  st.orgTaskDone = [...new Set([...(st.orgTaskDone || []), ...clean])];
  st.orgConfirmAt = Date.now();
  writeState(st);
  return { ok: true, count: clean.length };
}

/** 删除待办并存档（不当成确认生效，但算已处理） */
export async function archiveOrgTasks(ids) {
  await delay(180);
  const base = await loadJson("../mock/hr/org-diff-tasks.json");
  const st = readState();
  const archived = new Set(st.orgTaskArchived || []);
  const done = new Set(st.orgTaskDone || []);
  const log = [...(st.orgArchiveLog || [])];
  let n = 0;
  for (const id of ids) {
    if (archived.has(id) || done.has(id)) continue;
    const t = base.tasks.find((x) => x.id === id);
    if (!t) continue;
    archived.add(id);
    log.push({
      id: t.id,
      person: t.person,
      kind: t.kind,
      dept: t.dept,
      diff: t.diff,
      at: Date.now(),
      sourceFile: st.orgCsvName || base.sourceFile,
    });
    n += 1;
  }
  st.orgTaskArchived = [...archived];
  st.orgArchiveLog = log;
  writeState(st);
  return { ok: true, count: n };
}

export async function getOrgCurrent() {
  await delay(80);
  return loadJson("../mock/hr/org-current.json");
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

export async function getAiTool(id) {
  const tools = await getAiTools();
  return tools.find((t) => t.id === id) || null;
}

/** 调用基础 AI 能力：交材料+用户 → 当场结果 */
export async function runAiTool(account, toolId, payload) {
  await delay(480);
  const tool = await getAiTool(toolId);
  if (!tool) return { ok: false, error: "未知能力" };
  const text = (payload?.text || "").trim();
  const files = Array.isArray(payload?.files) ? payload.files : [];
  if (tool.input === "file" && !files.length) {
    return { ok: false, error: "请先选择文件" };
  }
  if (tool.input === "text" && !text) {
    return { ok: false, error: "请先填写内容" };
  }

  let resultText = tool.sampleResult || "";
  let points = null;
  let risks = null;
  if (toolId === "tts") {
    resultText = text;
  } else if (toolId === "content") {
    points = tool.samplePoints || [];
    risks = tool.sampleRisks || [];
    const head = text.replace(/\s+/g, " ").slice(0, 36);
    resultText =
      `依据你提交的片段（开头：「${head}${text.length > 36 ? "…" : ""}」）整理：\n` +
      "要点：\n" +
      points.map((p, i) => `${i + 1}. ${p}`).join("\n") +
      (risks.length
        ? "\n风险：\n" + risks.map((r) => `· ${r}`).join("\n")
        : "");
  } else if (toolId === "ocr" || toolId === "asr") {
    const names = files.map((f) => f.name).join("、");
    resultText =
      `【来自：${names || "未命名"}】\n` + (tool.sampleResult || "");
  }

  const st = readState();
  const job = {
    id: "ai-" + Date.now(),
    at: new Date().toISOString().slice(0, 16).replace("T", " "),
    toolId,
    toolName: tool.name,
    userId: account?.id || "",
    userName: account?.name || "",
    inputSummary:
      tool.input === "file"
        ? files.map((f) => f.name).join("；")
        : text.slice(0, 80) + (text.length > 80 ? "…" : ""),
    result: resultText,
    points,
    risks,
    speakText: toolId === "tts" ? text : null,
  };
  const hist = [...(st.aiToolRuns || [])];
  hist.unshift(job);
  st.aiToolRuns = hist.slice(0, 30);
  writeState(st);
  return { ok: true, job };
}

export async function getAiToolRuns(toolId) {
  await delay(40);
  const st = readState();
  const all = st.aiToolRuns || [];
  return {
    items: toolId ? all.filter((j) => j.toolId === toolId) : all,
  };
}

/** 文档入库：多机归属 + session 向导进度（docs/130） */
async function loadIngestCatalog() {
  return loadJson("../mock/ingest/machines.json");
}

function ingestSession() {
  const st = readState();
  if (!st.ingest) st.ingest = {};
  if (!st.ingest.byMachine) st.ingest.byMachine = {};
  if (!st.ingest.extraMachines) st.ingest.extraMachines = [];
  return st;
}

function allMachinesFrom(st, cat) {
  return [...(cat.machines || []), ...(st.ingest?.extraMachines || [])];
}

function canAccessMachine(account, machine) {
  if (!account || !machine) return false;
  if (account.role === "it") return true;
  return machine.ownerAccount === account.id;
}

function computePhase(machine, ov) {
  if (machine.phase === "ready" && !ov.forceWizard) return "ready";
  const bootstrapInstalled =
    ov.bootstrapInstalled != null
      ? !!ov.bootstrapInstalled
      : !!machine.bootstrap?.installed;
  const adminDone =
    ov.adminDone != null ? !!ov.adminDone : !!machine.adminAuth?.done;
  const probeReady =
    ov.probeReady != null
      ? !!ov.probeReady
      : machine.phase === "ready" || machine.probe?.slimSync === "在线";
  if (!bootstrapInstalled) return "need_bootstrap";
  if (!adminDone) return "need_admin";
  if (!probeReady) return "provisioning";
  return "ready";
}

function hydrateMachineState(machine, ov) {
  const phase = computePhase(machine, ov);
  const bootstrapInstalled =
    ov.bootstrapInstalled != null
      ? !!ov.bootstrapInstalled
      : !!machine.bootstrap?.installed || phase === "ready";
  const adminDone =
    ov.adminDone != null
      ? !!ov.adminDone
      : !!machine.adminAuth?.done || phase === "ready";
  const probeReady = phase === "ready";
  const dirs =
    ov.dirs != null ? ov.dirs : Array.isArray(machine.dirs) ? machine.dirs : [];

  let probe = machine.probe || {
    slimSync: "未安装",
    version: null,
    lastHeartbeat: null,
  };
  if (probeReady) {
    probe = {
      slimSync: ov.probeSlimSync || machine.probe?.slimSync || "在线",
      version: ov.probeVersion || machine.probe?.version || "0.9.2-win",
      lastHeartbeat:
        ov.probeSeen ||
        machine.probe?.lastHeartbeat ||
        new Date().toISOString().slice(0, 16).replace("T", " "),
    };
  } else if (adminDone) {
    probe = { slimSync: "安装中", version: null, lastHeartbeat: null };
  }

  return {
    machineId: machine.id,
    ownerAccount: machine.ownerAccount,
    ownerName: machine.ownerName,
    host: machine.host,
    osType: machine.osType || "Windows",
    osDetail: machine.osDetail || "",
    sshd: machine.sshd || (probe.slimSync === "在线" ? "在线" : "未知"),
    phase,
    bootstrap: {
      ...(machine.bootstrap || {}),
      installed: bootstrapInstalled,
      lastSeen: bootstrapInstalled
        ? ov.bootstrapSeen || machine.bootstrap?.lastSeen || null
        : null,
    },
    adminAuth: {
      ...(machine.adminAuth || { note: "管理员账密仅本次使用，不落库" }),
      done: adminDone,
    },
    syncAccount: {
      ...(machine.syncAccount || {
        username: "fos-ingest",
        userVisible: false,
      }),
      created: adminDone || probeReady,
    },
    probe,
    dirs,
    stats: machine.stats || { todayUploaded: "—", todayFiles: 0 },
  };
}

export async function listIngestMachines(account) {
  await delay(60);
  const cat = await loadIngestCatalog();
  const st = ingestSession();
  const all = allMachinesFrom(st, cat).map((m) => {
    const ov = st.ingest.byMachine[m.id] || {};
    const hydrated = hydrateMachineState(m, ov);
    return {
      id: m.id,
      ownerAccount: m.ownerAccount,
      ownerName: m.ownerName,
      host: m.host,
      osType: hydrated.osType,
      osDetail: hydrated.osDetail,
      phase: hydrated.phase,
      probe: hydrated.probe,
      sshd: hydrated.sshd,
      dirCount: (hydrated.dirs || []).length,
      mine: account?.id === m.ownerAccount,
      canManage: canAccessMachine(account, m),
    };
  });
  if (account?.role === "it") return { items: all, selectedId: null };
  return {
    items: all.filter((m) => m.ownerAccount === account?.id),
    selectedId: null,
  };
}

export async function getSelectedIngestMachineId(account, preferredId) {
  const cat = await loadIngestCatalog();
  const st = ingestSession();
  const all = allMachinesFrom(st, cat);
  const prefer = preferredId || st.ingest.selectedMachineId || null;
  if (prefer) {
    const m = all.find((x) => x.id === prefer);
    if (m && canAccessMachine(account, m)) return prefer;
  }
  const mine = all.find((x) => x.ownerAccount === account?.id);
  if (mine) return mine.id;
  if (account?.role === "it" && all[0]) return all[0].id;
  return null;
}

export async function setSelectedIngestMachine(account, machineId) {
  await delay(40);
  const cat = await loadIngestCatalog();
  const st = ingestSession();
  const m = allMachinesFrom(st, cat).find((x) => x.id === machineId);
  if (!m || !canAccessMachine(account, m)) {
    return { ok: false, error: "无权操作该机器" };
  }
  st.ingest.selectedMachineId = machineId;
  writeState(st);
  return { ok: true, machineId };
}

export async function registerIngestMachine(account, opts = {}) {
  await delay(200);
  if (!account?.id) return { ok: false, error: "未登录" };
  const cat = await loadIngestCatalog();
  const st = ingestSession();
  const host =
    String(opts.host || "").trim() ||
    `${account.name || "我"}-新机器`;
  const id = "M-" + Date.now();
  const tpl = cat.bootstrapTemplate || {};
  const machine = {
    id,
    ownerAccount: account.id,
    ownerName: account.name || account.id,
    host,
    osType: opts.osType || "Windows",
    osDetail: opts.osDetail || "Windows 11",
    phase: "need_bootstrap",
    bootstrap: {
      installed: false,
      version: tpl.version || "fos-sshd 0.1.0",
      downloadName: tpl.downloadName || "ForgeOS-Guide-SSHD-Setup.exe",
      port: tpl.port || 2222,
      lastSeen: null,
    },
    adminAuth: { done: false, note: "管理员账密仅本次使用，不落库" },
    syncAccount: {
      created: false,
      username: "fos-ingest",
      userVisible: false,
    },
    probe: { slimSync: "未安装", version: null, lastHeartbeat: null },
    dirs: [],
    stats: { todayUploaded: "—", todayFiles: 0 },
  };
  st.ingest.extraMachines = [...(st.ingest.extraMachines || []), machine];
  st.ingest.selectedMachineId = id;
  writeState(st);
  return { ok: true, machine };
}

async function resolveTargetMachine(account, machineIdOpt) {
  const cat = await loadIngestCatalog();
  const st = ingestSession();
  const id =
    machineIdOpt || (await getSelectedIngestMachineId(account, machineIdOpt));
  if (!id) return { error: "请先选择机器" };
  const machine = allMachinesFrom(st, cat).find((x) => x.id === id);
  if (!machine || !canAccessMachine(account, machine)) {
    return { error: "无权操作该机器" };
  }
  return { st, cat, machine, ov: st.ingest.byMachine[id] || {} };
}

export async function getIngestState(account, machineIdOpt) {
  await delay();
  const resolved = await resolveTargetMachine(account, machineIdOpt);
  if (resolved.error) {
    return {
      phase: "no_machine",
      error: resolved.error,
      machineId: null,
      dirs: [],
      fleet: [],
    };
  }
  const { st, machine, ov } = resolved;
  st.ingest.selectedMachineId = machine.id;
  writeState(st);
  const state = hydrateMachineState(machine, ov);
  const fleet = (await listIngestMachines({ role: "it", id: "wu.it" })).items.map(
    (r) => ({
      id: r.id,
      user: r.ownerName,
      ownerAccount: r.ownerAccount,
      host: r.host,
      sshd: r.sshd || "未知",
      slimSync: r.probe?.slimSync || "未知",
      version: r.probe?.version || "—",
      lastSeen: r.probe?.lastHeartbeat || "—",
      phase: r.phase,
    })
  );
  return { ...state, fleet };
}

function patchMachineOverlay(machineId, patch) {
  const st = ingestSession();
  st.ingest.byMachine[machineId] = {
    ...(st.ingest.byMachine[machineId] || {}),
    ...patch,
  };
  st.ingest.selectedMachineId = machineId;
  writeState(st);
}

export async function ingestMarkBootstrapInstalled(account, machineIdOpt) {
  const resolved = await resolveTargetMachine(account, machineIdOpt);
  if (resolved.error) return { ok: false, error: resolved.error };
  patchMachineOverlay(resolved.machine.id, {
    bootstrapInstalled: true,
    bootstrapSeen: new Date().toISOString().slice(0, 16).replace("T", " "),
    forceWizard: true,
  });
  return getIngestState(account, resolved.machine.id);
}

export async function ingestSubmitAdmin(account, _user, _pass, machineIdOpt) {
  await delay(400);
  const resolved = await resolveTargetMachine(account, machineIdOpt);
  if (resolved.error) return { ok: false, error: resolved.error };
  patchMachineOverlay(resolved.machine.id, {
    bootstrapInstalled: true,
    adminDone: true,
    probeReady: false,
    forceWizard: true,
  });
  return getIngestState(account, resolved.machine.id);
}

export async function ingestMarkProbeReady(account, machineIdOpt) {
  const resolved = await resolveTargetMachine(account, machineIdOpt);
  if (resolved.error) return { ok: false, error: resolved.error };
  patchMachineOverlay(resolved.machine.id, {
    bootstrapInstalled: true,
    adminDone: true,
    probeReady: true,
    forceWizard: false,
    probeSeen: new Date().toISOString().slice(0, 16).replace("T", " "),
    probeSlimSync: "在线",
    probeVersion: "0.9.2-win",
  });
  // 额外：把 extraMachines 基线 phase 提到 ready，避免反复 force
  const st = ingestSession();
  const extras = st.ingest.extraMachines || [];
  const ix = extras.findIndex((m) => m.id === resolved.machine.id);
  if (ix >= 0) {
    extras[ix] = {
      ...extras[ix],
      phase: "ready",
      bootstrap: {
        ...extras[ix].bootstrap,
        installed: true,
        lastSeen: st.ingest.byMachine[resolved.machine.id]?.bootstrapSeen,
      },
      adminAuth: { ...extras[ix].adminAuth, done: true },
      probe: {
        slimSync: "在线",
        version: "0.9.2-win",
        lastHeartbeat: st.ingest.byMachine[resolved.machine.id]?.probeSeen,
      },
    };
    st.ingest.extraMachines = extras;
    writeState(st);
  }
  return getIngestState(account, resolved.machine.id);
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

export async function ingestAddDir(account, path, machineIdOpt) {
  const res = await ingestAddDirs(account, [path], machineIdOpt);
  if (!res.ok) return res;
  return { ok: true, dirs: res.dirs, added: res.added };
}

/** 批量加入监视目录（当前目标机） */
export async function ingestAddDirs(account, paths, machineIdOpt) {
  await delay(180);
  const resolved = await resolveTargetMachine(account, machineIdOpt);
  if (resolved.error) return { ok: false, error: resolved.error };
  const cur = hydrateMachineState(resolved.machine, resolved.ov);
  if (cur.phase !== "ready") {
    return { ok: false, error: "请先完成本机接入" };
  }
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
  patchMachineOverlay(resolved.machine.id, { dirs });
  return { ok: true, dirs, added, skipped };
}

export async function ingestRemoveDir(account, id, machineIdOpt) {
  await delay(120);
  const resolved = await resolveTargetMachine(account, machineIdOpt);
  if (resolved.error) return { ok: false, error: resolved.error };
  const cur = hydrateMachineState(resolved.machine, resolved.ov);
  const dirs = (cur.dirs || []).filter((d) => d.id !== id);
  patchMachineOverlay(resolved.machine.id, { dirs });
  return { ok: true, dirs };
}

export async function listSharedSources(account) {
  await delay(80);
  if (account?.role !== "it") {
    return { ok: false, error: "仅 IT 可管理共享源", items: [] };
  }
  const cat = await loadIngestCatalog();
  return { ok: true, items: cat.sharedSources || [] };
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

export async function getStatus(account, opts = {}) {
  await delay(80);
  const scoped = Object.prototype.hasOwnProperty.call(opts, "appId");
  const appId = opts.appId || "";
  const onApp = (id) => !scoped || appId === id;
  const items = [];
  /* 传了 appId 则只挂所属 App；未传（旧壳）保持原行为 */
  if (
    (account.role === "manager" || account.role === "employee") &&
    onApp("aispace")
  ) {
    const mine = await getMyDeals(account, { scope: "mine", openOnly: true });
    const urgent = mine.filter((d) => d.bucket === "须尽快");
    if (urgent.length) {
      items.push({
        text: `${urgent.length} 单须尽快处理`,
        href: "./aispace.html?view=mine&f=urgent",
      });
    }
  }
  if (account.role === "hr" && onApp("aispace")) {
    const pack = await getOrgDiffTasks();
    if (pack.pendingCount) {
      items.push({
        text: `还有 ${pack.pendingCount} 条`,
        href: "./hr-org.html?view=tasks",
      });
    }
  }
  if (account.role === "it" && onApp("platform")) {
    const dash = await getItDashboard();
    const n = (dash.alerts || []).length;
    if (n) {
      items.push({
        text: `须处理 ${n} 项`,
        href: "./it-home.html?view=dashboard",
      });
    }
  }
  if (account.role === "boss" && onApp("biz")) {
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
  const services = await loadJson("../mock/it/services.json");
  return {
    jobs: services.jobs || [],
    dashboard: await loadJson("../mock/it/dashboard.json"),
    services,
    compute: await loadJson("../mock/it/compute.json"),
    aispaceCap: await loadJson("../mock/it/aispace-cap.json"),
    remote: await loadJson("../mock/it/remote.json"),
    storage: await loadJson("../mock/it/storage.json"),
  };
}

export async function getItDashboard() {
  await delay();
  return loadJson("../mock/it/dashboard.json");
}

export async function getItServices() {
  await delay();
  return loadJson("../mock/it/services.json");
}

export async function getItAudit() {
  await delay();
  return loadJson("../mock/it/audit.json");
}

export async function getComplianceWorkspace() {
  await delay();
  return loadJson("../mock/compliance/workspace.json");
}

export async function getItCompute() {
  await delay();
  return loadJson("../mock/it/compute.json");
}

export async function getItAispaceCap() {
  await delay();
  return loadJson("../mock/it/aispace-cap.json");
}

export async function getItRemote() {
  await delay();
  return loadJson("../mock/it/remote.json");
}

export async function getItStorage() {
  await delay();
  return loadJson("../mock/it/storage.json");
}

export async function restartItService(id) {
  await delay(200);
  const st = readState();
  st.itRestarts = [...(st.itRestarts || []), { id, at: Date.now() }];
  writeState(st);
  return { ok: true, id };
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

  if (role === "hr" || /花名册|变动|离职|交接|材料|导入|开通|组织/.test(q)) {
    const pack = await getOrgDiffTasks();
    return {
      text: cite([
        `还有 ${pack.pendingCount} 条对比出来的变动等人确认。`,
        "离职的人点进去能看他还剩哪些客户、项目和文件。",
      ]),
      actions: [
        { id: "go-org", label: "看待办事项", href: "./hr-org.html?view=tasks" },
        {
          id: "go-hand",
          label: "赵强还没交清什么",
          href: "./hr-org.html?view=task&id=OT-05",
        },
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
    const dash = await getItDashboard();
    const svc = await getItServices();
    const failed = (svc.jobs || []).filter((j) => j.status === "失败");
    const r = dash.resources || {};
    const inf = dash.inference || {};
    const nAlert = (dash.alerts || []).length;
    return {
      text: cite([
        `运行状态：GPU ${r.gpu ?? "—"}% · KV ${r.kvCache ?? "—"}% · TTFT ${inf.ttftP50Ms ?? "—"} ms · 排队 ${inf.queue ?? "—"}。`,
        nAlert ? `须处理 ${nAlert} 项。` : "暂无须处理项。",
        failed.length
          ? `夜间作业失败 ${failed.length} 条。`
          : "夜间作业当前无失败。",
        "可问：推理性能、服务树、远程探针、Token 消耗。",
      ]),
      actions: [
        { id: "go-dash", label: "运行状态", href: "./it-home.html?view=dashboard" },
        { id: "go-svc", label: "服务状态", href: "./it-home.html?view=services" },
        { id: "go-audit", label: "审计", href: "./it-home.html?view=audit" },
        { id: "go-remote", label: "远程机器", href: "./it-home.html?view=remote" },
      ],
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
