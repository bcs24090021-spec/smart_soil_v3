import { en } from "./en.js";
import { zh } from "./zh.js";

const DICTIONARIES = { en, zh };

export function t(lang, path, params = {}) {
  const dict = DICTIONARIES[lang] || en;
  const fallback = en;

  function lookup(dictEntry) {
    return path
      .split(".")
      .reduce((node, key) => (node == null ? undefined : node[key]), dictEntry);
  }

  let value = lookup(dict);
  if (value == null || typeof value === "object") value = lookup(fallback);

  if (typeof value !== "string") return path;
  return value.replace(/\{(\w+)\}/g, (match, key) => (params[key] != null ? String(params[key]) : match));
}

export function raw(lang, path) {
  const dict = DICTIONARIES[lang] || en;
  const fallback = en;
  function lookup(dictEntry) {
    return path
      .split(".")
      .reduce((node, key) => (node == null ? undefined : node[key]), dictEntry);
  }
  let value = lookup(dict);
  if (value == null) value = lookup(fallback);
  return value;
}

export { en, zh, DICTIONARIES };