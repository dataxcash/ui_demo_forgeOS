let dict = null;

const I18N_V = "nav33";

export async function loadI18n(locale = "zh-CN") {
  const res = await fetch(`../i18n/${locale}.json?v=${I18N_V}`);
  dict = await res.json();
  return dict;
}

export function t(key, fallback) {
  if (!dict) return fallback ?? key;
  return dict[key] ?? fallback ?? key;
}
