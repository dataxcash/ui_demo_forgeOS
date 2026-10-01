const KEY = "fos-webui-account";

export async function loadAccounts() {
  const res = await fetch("../mock/accounts.json");
  return res.json();
}

export function getAccountId() {
  return sessionStorage.getItem(KEY);
}

export function setAccountId(id) {
  sessionStorage.setItem(KEY, id);
}

export function clearAccount() {
  sessionStorage.removeItem(KEY);
}

export async function requireAccount() {
  const id = getAccountId();
  if (!id) {
    location.href = "./login.html";
    return null;
  }
  const accounts = await loadAccounts();
  const account = accounts.find((a) => a.id === id);
  if (!account || account.stub) {
    clearAccount();
    location.href = "./login.html";
    return null;
  }
  return account;
}

export function homeFor(account) {
  const map = {
    employee: "./my-deals.html",
    manager: "./my-deals.html",
    hr: "./hr-home.html",
    boss: "./boss-home.html",
    it: "./it-home.html",
    compliance: "./compliance-stub.html",
  };
  return map[account.role] || "./login.html";
}

/** 全员：文档入库 */
function ingestApp(account) {
  const items = [
    { href: "./ingest-upload.html", labelKey: "nav.ingestUpload", key: "ingest-upload" },
    { href: "./ingest-setup.html", labelKey: "nav.ingestSetup", key: "ingest-setup" },
    { href: "./sync-status.html", labelKey: "nav.ingestManage", key: "sync-status" },
  ];
  if (account.role === "it") {
    items.push({
      href: "./ingest-fleet.html",
      labelKey: "nav.ingestFleet",
      key: "ingest-fleet",
    });
  }
  return { id: "ingest", appKey: "app.ingest", items };
}

/** 全员：ai 工具 —— 按「活」进，无能力展览壳 */
function aiToolsApp() {
  return {
    appKey: "app.aitools",
    items: [
      { href: "./ai-tool.html?id=ocr", labelKey: "nav.aiOcr", key: "ai-ocr" },
      { href: "./ai-tool.html?id=asr", labelKey: "nav.aiAsr", key: "ai-asr" },
      { href: "./ai-tool.html?id=tts", labelKey: "nav.aiTts", key: "ai-tts" },
      {
        href: "./ai-tool.html?id=content",
        labelKey: "nav.aiContent",
        key: "ai-content",
      },
    ],
  };
}

/** 系统级 App（顶栏 MAIN）+ ROLE 工作区；二级只在侧栏 */
export function navGroupsFor(account) {
  const groups = [];

  if (account.role === "employee" || account.role === "manager") {
    const items = [
      { href: "./my-deals.html", labelKey: "nav.myDeals", key: "my-deals" },
    ];
    if (account.role === "manager") {
      items.push({
        href: "./team-deals.html",
        labelKey: "nav.teamDeals",
        key: "team-deals",
      });
    }
    groups.push({ id: "aispace", appKey: "app.aispace", items });
  } else if (account.role === "hr") {
    groups.push({
      id: "org",
      appKey: "app.org",
      items: [
        { href: "./hr-home.html", labelKey: "nav.hrHome", key: "hr-home" },
        { href: "./hr-import.html", labelKey: "nav.hrImport", key: "hr-import" },
      ],
    });
  } else if (account.role === "boss") {
    groups.push({
      id: "biz",
      appKey: "app.biz",
      items: [{ href: "./boss-home.html", labelKey: "nav.boss", key: "boss" }],
    });
  } else if (account.role === "it") {
    groups.push({
      id: "platform",
      appKey: "app.platform",
      items: [
        { href: "./it-home.html", labelKey: "nav.itHome", key: "it" },
        { href: "./it-job.html", labelKey: "nav.itJob", key: "it-job" },
      ],
    });
  }

  groups.push(ingestApp(account));
  groups.push({ ...aiToolsApp(), id: "aitools" });
  return groups;
}

/** 根据当前页 key 解析所属 App；二级菜单只渲染该 App */
export function resolveNav(account, activeKey) {
  const groups = navGroupsFor(account);
  const current =
    groups.find((g) => g.items.some((i) => i.key === activeKey)) || groups[0];
  return {
    groups,
    currentApp: current,
    sideItems: current ? current.items : [],
    activeKey,
  };
}

export function guardPage(account, allowedRoles) {
  if (!allowedRoles.includes(account.role)) {
    location.href = "./no-access.html";
    return false;
  }
  return true;
}
