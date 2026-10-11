# Caputo Home design direction

Picked 2026-10-11 from three mockup directions. Base is direction A ("Market":
the ivory ground, Plus Jakarta Sans titles, white add bar, the labelled white
tab bar) with direction C's color-coordinated tiles pulled in. Every screen
follows this file; `tailwind.config.js` holds the same values as tokens.

## Color roles

| Role | Hex | Use |
|---|---|---|
| ground | `#F5F7F7` | page background |
| surface | `#FFFFFF` | add bar, rows, tab bar, sheets |
| ink | `#2C2F30` | text, dark buttons, toast |
| ink-2 | `#5E6464` | subtitles, detail lines, inactive segment text |
| ink-3 | `#8A9090` | icon-only glyphs, placeholders. Never body text (fails 4.5:1) |
| hairline | `#E6EAEA` | tab bar top rule, dividers |
| control | `#EEF1F1` | neutral button fill (the stepper minus) |
| track | `#E9EDED` | segmented control track |
| danger | `#B42318` on `#FDECEA` | Out label, Remove button |

Store roles. Each store on the grocery list owns a tile tint, an ink and an
accent. Tile = section background and filter pill; ink = tile heading, count,
pill text; accent = checkbox ring and the plus button inside that tile.

| Store | tile | ink | accent |
|---|---|---|---|
| Pilgrim's | `#E1F0E3` | `#0F4F18` | `#176A21` |
| Costco | `#DCEAF6` | `#0B4A73` | `#005F99` |
| Grocery Store | `#F0E3F4` | `#6C1E82` | `#9128AD` |
| any other store | `#EEF1F1` | `#404545` | `#5E6464` |

Location roles. The Kitchen tab tints by the location that is showing, not by
category: every category tile in the Pantry is amber, switch to Fridge and the
page turns teal. Categories are too many to give each its own hue.

| Location | tile | ink | accent |
|---|---|---|---|
| Pantry | `#F6E9D2` | `#6E4E12` | `#C08B30` |
| Fridge | `#DDF0EF` | `#0E5555` | `#006A6A` |
| Freezer | `#DCEAF6` | `#0B4A73` | `#005F99` |
| Home goods | `#F0E6E9` | `#6B3A4A` | `#9B6B7A` |

Section accents (the active tab and the page's primary button): Grocery
`#176A21`, Kitchen = the showing location's accent, Planning `#C75A2A`,
Cookbook `#9128AD`.

## Type

Two families, already loaded in `index.html`.

- Plus Jakarta Sans 800, 32px, line 1.1, tracking -0.02em: page title.
- Plus Jakarta Sans 700, 17px: tile heading.
- Be Vietnam Pro 600, 16px: row name. 400, 14px: page subtitle. 400, 13px:
  row detail. 600, 13px: pills and tile counts. 600, 15px: buttons and
  segments. 600, 11px: tab labels.

Body text never drops below 13px. Inputs stay at 16px so iOS does not zoom.

## Shape and space

- Radius: 20 tile and add bar; 16 segmented control and primary button; 14 row,
  toast and sheet inner cards; 12 small buttons; full round for pills, the
  checkbox and the stepper.
- Screen gutter 20px. Tile padding 10px, rows 6px apart, sections 16px apart.
  Row padding 8px, 12px on the left.
- Shadow: tiles and rows have none (the tint separates them). The add bar and
  the active segment carry `0 2px 8px rgba(44,47,48,0.06)`; the toast
  `0 8px 24px rgba(44,47,48,0.18)`.
- Touch targets: 40px minimum, 44px for the primary action in a bar.

## Components

- Page header: title, one-line subtitle with live counts, one round 44px action
  on the right (scan). No app-wide header bar.
- Add bar: white, round 20, leading plus glyph, 16px input, accent "Add"
  button. Enter adds. `enterkeyhint="done"`.
- Filter pills: 34px tall, 13px/600, 12px side padding. "All" is ink-filled;
  store pills carry their tile tint and ink.
- Tile: tinted section with heading + count; rows are white, flat.
- Row: round checkbox (2px ring in the store accent), name over a detail line,
  stepper (neutral minus, bold count, accent plus). Tap the name to edit.
- Segmented control: track `#E9EDED`, round 16; active segment white with the
  location accent as text and the soft shadow.
- Toast: ink, round 14, sits 14px above the tab bar, optional Undo.
- Tab bar: white, hairline top rule, four tabs with 26px icons and 11px labels,
  active tab in the section accent, safe-area padding below.
- Sheet: slides up from the bottom, backdrop closes, Escape closes, body scroll
  locked, focus returns to the opener.

## Motion and icons

Motion only answers a tap: sheet 220ms slide, toast 200ms, check 150ms.
`prefers-reduced-motion` collapses all of it. Icons are `lucide-react`, 2px
stroke, 22px in controls and 26px in the tab bar. No emoji, no icon font.
