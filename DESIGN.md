# TaskFlow Design System

The single source of truth for how TaskFlow looks and behaves. Every page and every teammate follows this file. If a page disagrees with this file, the page is wrong.

Reference page: `public/styleguide.html` (the living style guide, open it at <http://localhost:3000/styleguide.html>). It starts as the approved dashboard mock-up and grows a section per component. When unsure how something should look, copy the reference, not your memory of other apps.

---

## 1. Direction in one paragraph

A calm, dense, product-grade work tool in the school of Linear, Height and the shadcn/ui dashboards: neutral cool greys, one indigo accent used only for the primary action, focus and selection, hairline borders instead of shadows, tabular numbers, small type (14 px body), generous whitespace between sections and tight spacing inside them. Light theme by default, a real dark theme (not inverted). It should look like software people pay for, not a template.

## 2. Stack (do not add other UI libraries)

| Layer        | What                                                                      | Notes                                                                                                                         |
| ------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| CSS engine   | Tailwind CSS v4 (`@tailwindcss/cli`)                                      | Source `src/styles/app.css` → built file `public/css/app.css` (committed, so `npm start` works with no build)                 |
| Components   | **Basecoat 1.3** (`basecoat-css`) — shadcn/ui ported to plain HTML        | Docs: `~/taskflow-design-library/basecoat/site/src/docs/components/<name>.mdx` (cloned by the setup script) or basecoatui.com |
| Behaviour JS | `public/vendor/basecoat.min.js` (Basecoat `all.min.js`)                   | Dropdowns, tabs, toasts, command palette, sidebar, select, combobox, popover                                                  |
| Icons        | Lucide via sprite `public/vendor/lucide.svg`                              | `<svg class="lucide"><use href="vendor/lucide.svg#bell"/></svg>`; names at lucide.dev                                         |
| Fonts        | Geist Variable (UI) + Geist Mono Variable (IDs, dates, numbers in tables) | Self-hosted from `@fontsource-variable/*`, copied to `public/css/files/`                                                      |
| Charts       | Chart.js + Basecoat chart defaults (Reports page only)                    | Colours from tokens, never Chart.js defaults                                                                                  |

No React, no Bootstrap, no extra CSS frameworks, no CDN links (the demo laptop may be offline). The frontend stays plain HTML + JS in `public/` so the Layered architecture from Milestone 1 is unchanged.

### Basecoat 1.3 API — the common mistake

Basecoat 1.x uses **one class plus data attributes**. The old `btn-outline` / `btn-sm-ghost` style classes do not exist any more.

```html
<button class="btn">Save</button>
<!-- primary -->
<button class="btn" data-variant="outline">Cancel</button>
<button class="btn" data-variant="ghost" data-size="icon-sm" aria-label="Close">…</button>
<button class="btn" data-variant="destructive">Delete task</button>
<a class="btn" data-variant="link" data-size="sm" href="…">View all</a>
<span class="badge">Done</span> <span class="badge" data-variant="outline">High</span>
```

Variants: `primary | secondary | outline | ghost | link | destructive`. Sizes: `xs | sm | default | lg | icon | icon-xs | icon-sm | icon-lg`. In the app chrome use `data-size="sm"` for buttons (32 px high).

Other components and their root markup: `dialog.dialog` (native `<dialog>`, open with `.showModal()`), `section.empty`, `div.field` / `fieldset.fieldset`, `input.input`, `div.table-container > table.table`, `div.skeleton`, `ol#toaster.toaster` (call `toaster.toast({category, title, description, action})`), `aside.sidebar`, `.tabs`, `.dropdown-menu`, `.popover`, `.command`, `.progress`. Read the matching `.mdx` before using one you have not used yet.

## 3. Tokens

Defined once in `src/styles/app.css` (`:root` for light, `.dark` for dark), mapped into Tailwind with `@theme inline`. Use the Tailwind names (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-status-done`), never raw hex or Tailwind palette colours like `bg-blue-500`.

| Token              | Light                           | Use                                                                                           |
| ------------------ | ------------------------------- | --------------------------------------------------------------------------------------------- |
| `background`       | near-white cool grey            | page                                                                                          |
| `card`             | white                           | panels, tables, lists                                                                         |
| `sidebar`          | slightly darker than background | left navigation                                                                               |
| `foreground`       | grey 21%                        | text                                                                                          |
| `muted-foreground` | grey 52%                        | secondary text, labels, meta                                                                  |
| `border`           | grey 91.5%                      | every hairline (1 px)                                                                         |
| `primary`          | indigo `oklch(0.52 0.19 268)`   | primary button, focus ring, selected item, progress fill. Max **one** primary button per view |
| `destructive`      | red                             | delete actions only                                                                           |
| `status-todo`      | grey                            | To do                                                                                         |
| `status-progress`  | amber                           | In progress                                                                                   |
| `status-done`      | green                           | Done                                                                                          |
| `status-blocked`   | red                             | Blocked / overdue                                                                             |

Status colour appears only as a 8 px dot (`.status-dot`) or text, never as a full coloured background block. Priority is a `badge` (`outline` for High, `secondary` for Medium/Low) — not a colour.

Radius: `--radius: 0.5rem` (8 px) for cards, inputs, buttons; full for avatars and dots. Shadows: none on cards; `shadow-sm` only on popovers, dropdowns and dialogs (Basecoat default).

## 4. Typography

| Role                 | Class                                     | Size / weight                                      |
| -------------------- | ----------------------------------------- | -------------------------------------------------- |
| Page title           | `text-2xl font-semibold`                  | 24/600, tracking −0.015em                          |
| Section title        | `font-medium` (base 14 px)                | 14/500                                             |
| Body                 | default                                   | 14/400                                             |
| Meta, captions       | `text-xs text-muted-foreground`           | 12/400                                             |
| Eyebrow              | `.eyebrow`                                | 12/500 uppercase, wide tracking — max one per page |
| Big numbers          | `.stat-value`                             | 24/600, `tabular-nums`                             |
| IDs, dates in tables | `font-mono text-xs text-muted-foreground` | `TF-112`                                           |

Sentence case everywhere ("New task", not "New Task"). No text larger than 24 px inside the app (the login page may use 30 px).

## 5. Layout: the app shell

Every page after login uses the same shell (built by `public/js/layout.js`, never copy-pasted):

```
┌ sidebar 256px ─────────┬ topbar 48px: breadcrumb · search (Ctrl K) · bell · ───────┐
│ TF TaskFlow            │                                                            │
│ Dashboard              │  max-w-6xl mx-auto px-6 py-8                               │
│ My tasks               │  ┌ page header: eyebrow? · h1 · primary action (right) ┐   │
│ Projects               │  └──────────────────────────────────────────────────────┘   │
│ Notifications   (3)    │  content sections, 32 px apart (mt-8), 12 px between a     │
│ Reports                │  section title and its panel (mt-3)                        │
│ ─ Projects ─           │                                                            │
│ • Website relaunch     │                                                            │
│ user · theme toggle    │                                                            │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

- Sidebar collapses to an overlay under `md`. Current page link gets `aria-current="page"`.
- Topbar is sticky with `bg-background/80 backdrop-blur` and a bottom hairline.
- Lists of things are **rows in one bordered card with `divide-y`**, not a grid of separate cards. Row height 40–44 px, hover `bg-muted/50`, the whole row is the link.
- Stats are one bordered strip split by 1 px gaps (`gap-px bg-border`), not four floating cards.
- Forms live in dialogs (create/edit) or a right-side panel; pages are for reading.

## 6. States — every data view has all four

| State   | How                                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading | `skeleton` rows matching the final layout (3–5 rows). Never a lone spinner in the middle of a blank page                                            |
| Empty   | `section.empty` with a Lucide icon, one-line title, one helpful sentence, and the primary action ("Create your first task")                         |
| Error   | Inline `alert` in the panel with what failed and a "Try again" button; plus a toast for action failures. Use the server's JSON `error.message` text |
| Success | Toast for actions (`category: 'success'`), 3 s, with "Undo" where it can be undone                                                                  |

Unauthorised (401) → `api.js` clears the token and redirects to `login.html?next=…`. Forbidden (403) → inline message "Only the project manager can …". 409 on a blocked task → toast naming the blocking task.

## 7. Motion and interaction

- 150 ms `ease-out` for hover/press/open; 200 ms for dialogs. Nothing longer, nothing bouncy.
- Respect `prefers-reduced-motion: reduce` (turn transitions off).
- Keyboard: `Ctrl/Cmd K` command palette, `c` new task (when not typing), `Esc` closes dialogs, every action reachable by Tab with a visible focus ring.
- Optimistic updates for status changes and drag-and-drop; roll back and toast on failure.

## 8. Copy

Verbs on buttons ("Create task", "Mark as read", "Export CSV"). Relative dates in lists ("Today", "Tomorrow", "2d late"), absolute dates in detail views ("Tue 24 Nov, 14:03"). No exclamation marks, no emoji, no "Oops". Errors say what happened and what to do.

## 9. Anti-slop rules (reject the page if any appear)

1. Purple-to-blue or any decorative gradients; glassmorphism cards; glowing blobs.
2. Grids of identical cards with an icon in a coloured circle on top.
3. Coloured left-border "accent" cards, cards inside cards.
4. More than one accent colour, or Tailwind palette colours (`bg-blue-500`, `text-purple-600`).
5. Emoji as icons; mixed icon sets; icons without `aria-label` on icon-only buttons.
6. Centred everything; hero sections inside the app; marketing copy in the product.
7. Default browser controls (unstyled `<select>`, `<input type="date">` without `.input`), default Chart.js colours.
8. Shadows on every card; borders thicker than 1 px; rounded-2xl/3xl blobs.
9. Lorem ipsum, fake numbers left in production pages, "Welcome to TaskFlow!" banners.
10. Spinners instead of skeletons; blank screens on error.

Run `npx impeccable detect public/` before every PR and fix what it reports (allow the brand font: `npx impeccable ignores add-value overused-font "Geist Variable" --reason "Brand font"`).

## 10. Page recipes

| Page                     | Recipe                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login.html`             | Split screen: left 50 % form on `card` (logo, "Sign in to TaskFlow", email, password, primary button full width, demo-account hint in `text-xs`), right 50 % `bg-sidebar` with a static product screenshot of the dashboard. No shell. |
| `index.html` (Dashboard) | Exactly the reference page with real data: greeting, stat strip, "Due soon" list, "Project progress".                                                                                                                                  |
| `my-tasks.html`          | Toolbar (search input, status/priority filter chips, sort select) + `table.table` (status dot, ID, title, project, priority badge, due, assignee avatar) + pagination. Filters live in the URL query.                                  |
| `projects.html`          | Header with "New project"; list rows (name, description, member avatars, progress bar, open task count).                                                                                                                               |
| `project.html`           | Header (name, members, progress, "New task"); `tabs`: Board · List · Activity · Settings. Board = 4 columns (To do, In progress, Blocked shown as a filter, Done) with compact task cards (title, ID, priority, due, avatar).          |
| `task.html`              | Two columns: main (title, description, Comments, Activity) and a right properties panel (status select, assignee, priority, due date, repeats, blocked-by list) like Linear's issue view.                                              |
| `notifications.html`     | Inbox list grouped by Today / Earlier; unread rows have a primary dot; "Mark all as read".                                                                                                                                             |
| `reports.html`           | Project select + date range; stat strip; status breakdown (bar), completion over time (line), workload per member (horizontal bar), overdue table; "Export CSV".                                                                       |
| `settings.html`          | Fieldsets: Profile, Notifications (switches per type), Appearance (Light / Dark / System).                                                                                                                                             |

## 11. Accessibility minimums

Contrast ≥ 4.5:1 for text (tokens already pass; do not lighten `muted-foreground`), labels on every input, `aria-live="polite"` on the toaster and the bell count, landmarks (`nav`, `main`), focus trapped in dialogs (native `<dialog>` does this), hit targets ≥ 32 px.

## 12. Checklist before opening a PR that touches `public/`

- [ ] Uses the shell from `layout.js`; no page-specific copies of the sidebar/topbar
- [ ] Only tokens and Basecoat classes; `npm run build:css` run and `public/css/app.css` committed
- [ ] Loading, empty and error states present
- [ ] Light and dark theme both checked (screenshots in the PR)
- [ ] Keyboard-only walk-through works
- [ ] `npx impeccable detect public/` clean
- [ ] Existing element ids used by tests (`#status`, `#welcome`, `#app-header`, form ids) still exist

---

Credits: built on Basecoat (MIT, hunvreus), Tailwind CSS (MIT), Lucide (ISC), Geist (OFL), with layout cues from the Linear DESIGN.md in VoltAgent/awesome-design-md (MIT). Full list in `CREDITS.md`.
