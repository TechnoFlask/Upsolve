# Upsolve — design notes

Keep these in mind for every new screen so later phases stay consistent.

## Idea

Competitive programmers read colour as rank: a Codeforces handle in orange means master and
in grey means newbie. Upsolve borrows that. **The one bold element is difficulty shown as
rating-coloured ink**: a problem's name is printed in its platform's rating-tier colour. Everything
around it stays quiet (cool paper, slate ink, plain rules), so that colour is what you notice.

## Tokens

| Name | Hex | Use |
|---|---|---|
| paper | `#EEF1F4` | Page background, cool and slightly blue like graph paper |
| sheet | `#FFFFFF` | Table and dialog surfaces |
| ink | `#1B2430` | Text, primary borders |
| pencil | `#5B6878` | Secondary text, IDs, metadata |
| rule | `#D3D9E0` | Row rules, input borders |
| accepted | `#16803C` | Primary action, "Solved". Judge-verdict green |

Status colours borrow from judge verdicts: solved = accepted green, attempted = wrong-answer red
`#C62828`, upsolve = amber `#A85F00`, revisit = blue `#1D4ED8`.

Rating tiers (darkened where needed to pass contrast on white) live in `src/lib/difficulty.ts`.

## Type

- **Bricolage Grotesque**: wordmark and page titles only. Its quirky optical sizing gives the brand a voice.
- **Public Sans**: everything else. Plain and highly legible, with tabular figures for ratings, tries and dates.
- Scale (rem): 0.8125 meta, 0.9375 body/table, 1.125 dialog titles, 2.25 page titles.
- Sentence case everywhere. No all-caps labels, no monospace for data.

## Layout

```
┌───────────────────────────────────────────────┐
│ upsolve   Problems                     Lock   │  top bar on paper
├───────────────────────────────────────────────┤
│ Problems                       [Add problem]  │  page title + one-line summary
│ 48 tracked, 6 waiting to be upsolved.         │
│ [search……] Platform▾ Status▾ Tag▾ 800–1600 …  │  filter row, wraps on mobile
│ ┌───────────────────────────────────────────┐ │
│ │ Clock Conversion  1950C  Codeforces  1200 │ │  one sheet, rows split by rules
│ │ …                                         │ │
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

Left-aligned. Desktop shows a table; below `md` each row stacks into two lines.
Add/edit opens a native `<dialog>`: a right-side panel on desktop, full screen on phones.

## Principles

1. Colour encodes data (tier, status). It is never decoration.
2. One surface, the sheet. No card grid, no shadows except the open dialog.
3. Motion only answers an action: the dialog sliding in. Respect `prefers-reduced-motion`.
4. Copy says what happens: "Add problem", "Save changes", "Delete problem".

## Contest letter strip

Contests show their problems as index letters, as on a Codeforces standings row: filled green =
solved during the contest, green outline = upsolved, red outline = attempted, dashed amber = queued,
grey = not tried. It's the contest page's encoding of data, not a second bold element; the rating-tier
ink stays the signature.

## Rejected defaults (don't drift back)

- Monospace problem IDs → tabular Public Sans in pencil grey.
- Coloured platform pills → plain muted platform name. The tier colour already carries the colour budget.
- Rounded stat cards above the table → a single summary sentence.
