/** ForgeOS 系统 outline icon：16×16 · stroke 1.5 · 无填充 · 无背景容器 */

const ATTR = `xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;

/** @type {Record<string, string>} */
const PATHS = {
  layout: `<svg ${ATTR}><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></svg>`,
  layers: `<svg ${ATTR}><path d="M2 5.5 8 2l6 3.5L8 9 2 5.5Z"/><path d="M2 8.5 8 12l6-3.5"/><path d="M2 11.5 8 15l6-3.5"/></svg>`,
  chip: `<svg ${ATTR}><rect x="4.5" y="4.5" width="7" height="7" rx="0.5"/><path d="M7 2.5v2M9 2.5v2M7 11.5v2M9 11.5v2M2.5 7h2M2.5 9h2M11.5 7h2M11.5 9h2"/></svg>`,
  nodes: `<svg ${ATTR}><circle cx="4" cy="4" r="1.75"/><circle cx="12" cy="4" r="1.75"/><circle cx="8" cy="12" r="1.75"/><path d="M5.5 4.8 6.8 10.2M10.5 4.8 9.2 10.2M5.6 4h4.8"/></svg>`,
  monitor: `<svg ${ATTR}><rect x="2" y="2.5" width="12" height="8.5" rx="0.5"/><path d="M6 14h4M8 11v3"/></svg>`,
  disk: `<svg ${ATTR}><ellipse cx="8" cy="4" rx="5" ry="2"/><path d="M3 4v6c0 1.1 2.2 2 5 2s5-.9 5-2V4"/><path d="M3 7c0 1.1 2.2 2 5 2s5-.9 5-2"/></svg>`,
  list: `<svg ${ATTR}><path d="M5 4h9M5 8h9M5 12h9"/><path d="M2.5 4h.01M2.5 8h.01M2.5 12h.01"/></svg>`,
  users: `<svg ${ATTR}><circle cx="6" cy="5.5" r="2"/><path d="M2.5 13c.4-2.2 1.9-3.5 3.5-3.5S9.1 10.8 9.5 13"/><circle cx="11" cy="6" r="1.6"/><path d="M10 9.6c1.3.2 2.4 1.2 2.8 3.4"/></svg>`,
  person: `<svg ${ATTR}><circle cx="8" cy="5" r="2.2"/><path d="M3.5 13.5c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4"/></svg>`,
  checklist: `<svg ${ATTR}><path d="M3.5 4.5 5 6l3-3.5"/><path d="M3.5 10.5 5 12l3-3.5"/><path d="M9.5 5h4M9.5 11h4"/></svg>`,
  upload: `<svg ${ATTR}><path d="M8 10.5V3.5M5.5 5.5 8 3l2.5 2.5"/><path d="M3 12.5h10"/></svg>`,
  inbox: `<svg ${ATTR}><path d="M2.5 6.5 4 3h8l1.5 3.5v5a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-5Z"/><path d="M2.5 6.5h3.2c.4 1.4 1.3 2 2.3 2s1.9-.6 2.3-2h3.2"/></svg>`,
  plug: `<svg ${ATTR}><path d="M6 2.5v3M10 2.5v3"/><rect x="4.5" y="5.5" width="7" height="5" rx="0.5"/><path d="M8 10.5v3"/></svg>`,
  gauge: `<svg ${ATTR}><path d="M3.2 12a5.8 5.8 0 1 1 9.6 0"/><path d="M8 9.5 10.5 5.5"/></svg>`,
  tool: `<svg ${ATTR}><path d="M10.2 2.8a2.4 2.4 0 0 0-3.1 3.1L3.5 9.5l3 3 3.6-3.6a2.4 2.4 0 0 0 3.1-3.1L11 8 8 5l2.2-2.2Z"/></svg>`,
  chart: `<svg ${ATTR}><path d="M2.5 13.5h11"/><path d="M4.5 13V8M8 13V4.5M11.5 13V7"/></svg>`,
  machine: `<svg ${ATTR}><rect x="2.5" y="3" width="11" height="8" rx="0.5"/><path d="M5 14h6M6.5 11v3M9.5 11v3"/></svg>`,
  share: `<svg ${ATTR}><circle cx="4" cy="8" r="1.75"/><circle cx="12" cy="4" r="1.75"/><circle cx="12" cy="12" r="1.75"/><path d="M5.6 7.2 10.4 4.8M5.6 8.8 10.4 11.2"/></svg>`,
  search: `<svg ${ATTR}><circle cx="7" cy="7" r="3.5"/><path d="M10 10.5 13.5 14"/></svg>`,
  shield: `<svg ${ATTR}><path d="M8 2.5 3.5 4.5v3.2c0 3 2 5.2 4.5 6.3 2.5-1.1 4.5-3.3 4.5-6.3V4.5L8 2.5Z"/></svg>`,
  fleet: `<svg ${ATTR}><rect x="2" y="4" width="5.5" height="4.5" rx="0.4"/><rect x="8.5" y="4" width="5.5" height="4.5" rx="0.4"/><path d="M3.5 12.5h3M9.5 12.5h3M5 8.5v2M11 8.5v2"/></svg>`,
};

/** nav key → icon */
const BY_NAV_KEY = {
  "it-dashboard": "layout",
  "it-services": "layers",
  "it-compute": "chip",
  "it-aispace": "nodes",
  "it-audit": "shield",
  "it-remote": "monitor",
  "it-storage": "disk",
  "my-deals": "list",
  "team-deals": "users",
  "hr-current": "person",
  "hr-tasks": "checklist",
  "hr-upload": "upload",
  boss: "chart",
  "ingest-upload": "upload",
  "ingest-machines": "machine",
  "ingest-setup": "plug",
  "sync-status": "inbox",
  "ingest-manage": "inbox",
  "ingest-fleet": "fleet",
  "ingest-shared": "share",
  "ai-ocr": "search",
  "ai-asr": "tool",
  "ai-tts": "tool",
  "ai-content": "list",
};

/** app id → icon（顶栏） */
const BY_APP = {
  aispace: "nodes",
  platform: "gauge",
  ingest: "inbox",
  aitools: "tool",
  biz: "chart",
};

export function iconSvg(name) {
  return PATHS[name] || PATHS.layout;
}

export function iconForNavKey(key) {
  return BY_NAV_KEY[key] || null;
}

export function iconForApp(appId) {
  return BY_APP[appId] || null;
}

/** 侧栏 / 顶栏：icon + 文字 */
export function navIconLabel(iconName, labelHtml) {
  if (!iconName) return labelHtml;
  return `<span class="nav-ico">${iconSvg(iconName)}</span><span class="nav-txt">${labelHtml}</span>`;
}

/** 页头标题：同一套 outline */
export function pageTitleHtml(iconName, titleText) {
  const ico = iconName ? `<span class="page-ico">${iconSvg(iconName)}</span>` : "";
  return `${ico}<span>${titleText}</span>`;
}
