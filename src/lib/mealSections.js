export const DEFAULT_SECTIONS = ["Rob's Picks", "Cheyene's Picks"]

// Map historical section names (from before custom sections were removed
// and before the spelling fix) to a current default. Any pick stored with
// a section not in DEFAULT_SECTIONS gets resolved through this so it still
// renders under the right person.
const SECTION_ALIASES = {
  "Cheyenne's Picks": "Cheyene's Picks",
}

export function resolveSection(sectionName) {
  if (!sectionName) return DEFAULT_SECTIONS[0]
  if (DEFAULT_SECTIONS.includes(sectionName)) return sectionName
  if (SECTION_ALIASES[sectionName]) return SECTION_ALIASES[sectionName]
  return DEFAULT_SECTIONS[0]
}
