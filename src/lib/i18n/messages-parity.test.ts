import { describe, expect, it } from "vitest";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";

/**
 * Parity check: every key present in one locale must exist in the
 * other. Catches the "I added an English string but forgot to
 * translate it" bug at CI time, before users see a `missing:foo.bar`
 * placeholder.
 */

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out.add(path);
    } else {
      for (const sub of flatten(v, path)) out.add(sub);
    }
  }
  return out;
}

const frKeys = flatten(fr as Tree);
const enKeys = flatten(en as Tree);

describe("i18n message parity", () => {
  it("has the same set of keys in fr.json and en.json", () => {
    const onlyInFr = [...frKeys].filter((k) => !enKeys.has(k)).sort();
    const onlyInEn = [...enKeys].filter((k) => !frKeys.has(k)).sort();

    // Asserting on the diff (not the sizes) gives a useful error
    // message listing exactly which keys drifted.
    expect({ onlyInFr, onlyInEn }).toEqual({ onlyInFr: [], onlyInEn: [] });
  });

  it("has no empty string values", () => {
    const allEmpty: string[] = [];
    const check = (tree: Tree, prefix: string, locale: string) => {
      for (const [k, v] of Object.entries(tree)) {
        const path = `${locale}:${prefix ? `${prefix}.${k}` : k}`;
        if (typeof v === "string") {
          if (v.trim() === "") allEmpty.push(path);
        } else {
          check(v, prefix ? `${prefix}.${k}` : k, locale);
        }
      }
    };
    check(fr as Tree, "", "fr");
    check(en as Tree, "", "en");
    expect(allEmpty).toEqual([]);
  });
});
