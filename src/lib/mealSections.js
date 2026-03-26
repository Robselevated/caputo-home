export const DEFAULT_SECTIONS = ["Rob's Picks", "Cheyenne's Picks"]

export function getSections(householdId) {
  const custom = JSON.parse(localStorage.getItem(`meal-sections-${householdId}`) || '[]')
  return [...DEFAULT_SECTIONS, ...custom.filter(s => !DEFAULT_SECTIONS.includes(s))]
}

export function addCustomSection(householdId, name) {
  const custom = JSON.parse(localStorage.getItem(`meal-sections-${householdId}`) || '[]')
  if (!custom.includes(name) && !DEFAULT_SECTIONS.includes(name)) {
    custom.push(name)
    localStorage.setItem(`meal-sections-${householdId}`, JSON.stringify(custom))
  }
  return getSections(householdId)
}
