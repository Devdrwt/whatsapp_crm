# DESIGN.md — Drwintech CRM

Design system of record for this repository. Written in English to match
`AGENTS.md` and the code comments; the user-facing docs in `docs/` stay in
French.

The tokens themselves live in [`src/app/globals.css`](src/app/globals.css)
and are the single source of truth for values. This file exists for what
CSS cannot express: the rules, the rationale, and the calls already made.
When the two disagree, the CSS wins and this file is stale — fix it.

**Precedence for any UI work:** the user's explicit instruction → this
document → shadcn/ui defaults. Never the reverse.

---

## 1. Atmosphere

A dense, quiet operator tool. Agents live in this interface for hours
handling customer conversations; it is closer to a mail client or a
terminal than to a marketing site. Chrome recedes, content leads.

Three consequences that shape every decision below:

- **Compact by default.** The default button is `h-8`, and `xs` goes down
  to `h-6`. Spacious padding is not "premium" here, it is lost rows.
- **Calm, not colourful.** Colour marks state and action. A screen where
  everything is tinted has no signal left.
- **Fast feedback over animation.** Transitions are short and functional.
  There is no ambient motion.

The light theme is named **Lumière** — clean, airy, soft. The dark theme
is its equal, not an afterthought: both are fully specified and both get
tested.

---

## 2. Colour

Defined in OKLCH, deliberately. It is perceptually uniform, so lightening
a hue by hand keeps the same perceived step — the reason the scales stay
even across both themes.

### The accent is fixed

**Emerald–teal, `oklch(0.62 0.14 165)` in light, `oklch(0.70 0.14 165)`
in dark.** This is one brand, not a theme picker. Do not introduce a
second accent hue, do not add a per-org colour option, and do not reach
for the shadcn default blue.

To retune the brand, change `--primary` and `--chart-1` *in both blocks*
and nothing else.

### Roles

| Token | Role |
|---|---|
| `--background` / `--foreground` | Page ground and body text |
| `--card` / `--popover` | Raised surfaces. Pure white in light, lifted grey in dark |
| `--primary` | The single accent. Primary actions, active nav, focus ring |
| `--primary-hover` | Darker in light, **lighter in dark** — contrast against the ground, not a fixed shift |
| `--primary-soft` / `--primary-soft-2` | 10% and 18% accent washes. Selected rows, badges, subtle fills |
| `--secondary` | Neutral button ground |
| `--muted` / `--muted-foreground` | Recessed surfaces and secondary text |
| `--accent` | A pale teal *surface*, not the brand accent. Hover and highlight grounds |
| `--destructive` | Danger. See the soft-destructive rule in §4 |
| `--border` / `--input` / `--ring` | Hairlines, field edges, focus |
| `--chart-1…5` | Data series. `chart-1` is the brand; the rest are distinguishable at a glance, not a gradient |
| `--sidebar-*` | The sidebar carries its own set so it can sit a step apart from the page |

### Neutrals are biased, not grey

Every neutral carries a slight hue: `210–250` in light, `220–235` in
dark. Pure `oklch(x 0 0)` appears exactly once, for white cards. A
neutral with no bias reads as unconsidered next to these.

---

## 3. Typography

| Role | Face | Token |
|---|---|---|
| Body, UI | **Inter** | `--font-sans` |
| Headings `h1–h3` | **Plus Jakarta Sans** | `--font-heading` |
| Code, IDs, numbers | Geist Mono | `--font-mono` |

Headings carry `letter-spacing: -0.011em`. Do not add tracking elsewhere;
it is a heading correction, not a style.

Rules:

- Body text is `text-sm` in dense views. `text-base` is for reading
  surfaces — documentation, empty-state prose — not for table rows.
- Use `font-medium` for emphasis. `font-bold` in the interface is
  reserved for headings.
- Anywhere digits align in a column — counts, currency, timestamps —
  add `tabular-nums`.
- Never set a colour on text that the surface behind it does not come
  from the same token set as.

---

## 4. Components

Built on shadcn/ui with Base UI primitives. Extend the existing variants
before adding new ones; a one-off `className` on a button is a smell.

### Buttons

Six variants, and the set is deliberate:

`default` · `outline` · `secondary` · `ghost` · `destructive` · `link`

Two properties worth keeping:

- **`destructive` is soft, not solid** — `bg-destructive/10` with
  destructive-coloured text, not a filled red block. Deleting a contact
  is routine work, not an alarm. Reserve full-bleed red for a genuine
  confirmation step.
- **`active:translate-y-px`** — the button physically depresses. It is
  the only decorative motion in the system and it earns its place by
  confirming the press on slow connections.

Focus is `ring-3` at 50% accent. Do not remove it, do not shrink it.

### Surfaces

Cards use `--radius: 0.75rem` through the `rounded-lg` scale. All other
radii derive from it (`--radius-sm` is `0.6×`, `--radius-xl` is `1.4×`),
so changing `--radius` retunes the whole product coherently. Never
hard-code a pixel radius.

### State

State is shape *and* colour, never colour alone — a pill, a dot, a
weight change. Roughly 8% of men have some form of colour-vision
deficiency, and this is an interface people work in all day.

---

## 5. Layout

- **Sidebar + content.** The sidebar carries its own token set and sits
  one step off the page ground.
- **Lay out with flex/grid and `gap`**, not per-element margins. Sibling
  spacing that collapses or doubles is the most common layout bug here.
- **Wide content scrolls inside its own container** — `overflow-x: auto`
  on the wrapper. The page body never scrolls sideways.
- **Keep reading measures near 65–75 characters.** Conversation bubbles
  and documentation both.

---

## 6. Depth

Two elevations, and only two:

- `--shadow-card` — barely there. Two stacked shadows at 4–6% in light,
  30–40% in dark.
- `--shadow-elevate` — popovers, dropdowns, dialogs.

Shadows in dark mode are *stronger*, not weaker: on a dark ground a faint
shadow is invisible and the surface floats without anchor.

Nothing else gets a shadow. Depth here comes from surface colour and
hairline borders, not from stacking blur.

---

## 7. Do / Don't

**Do**

- Take every colour from a token, in both themes.
- Extend an existing variant rather than adding a className.
- Give every interactive element a visible focus state.
- Respect `prefers-reduced-motion`.
- Write UI copy from the user's side: a person manages *notifications*,
  not *webhook config*. Buttons say what happens — `Envoyer`, then a
  toast that says `Envoyé`.
- Keep French as the interface language. Arabic with RTL is planned;
  do not hard-code text direction.

**Don't**

- Don't add a second accent hue, or a per-tenant colour picker.
- Don't put a gradient on a surface, a button or a heading. Exactly two
  exist and both are load-bearing: the brand mark in
  `layout/brand.tsx` (`--primary` → teal, in OKLCH) and the dot grid on
  the automations canvas (`radial-gradient` off `var(--border)`). Extend
  that list only for another identity or pattern element.
- Don't use emoji as section markers or status icons — Lucide icons,
  which are already a dependency.
- Don't add ambient or scroll-triggered animation.
- Don't hard-code hex, rgb or pixel radii.
- Don't define a colour only inside `.dark` — it will be undefined in
  light and the surface will render one theme's text on the other's
  ground.
- Don't reach for a bigger, more padded component to signal importance.
  Density is the point.

---

## 8. Responsive

Mobile matters: agents answer conversations from a phone. The inbox is
the screen to check first at narrow widths — it carries a list, a thread
and a composer at once and degrades worst.

Use relative units, `max-width: 100%` on media, and collapse the sidebar
rather than shrinking its contents.

---

## 9. Agent prompt guide

When asked to build or modify UI in this repository:

1. Read `src/app/globals.css` for current values; treat it as truth.
2. Use existing shadcn components from `src/components/ui/`. Check
   before creating.
3. Style through tokens only.
4. Ship both themes in the same change, and check the dark one.
5. Match the density of the surrounding screens.
6. French copy, `next-intl` for anything user-visible — no hard-coded
   strings in components.
7. Run `npm run lint` and `npx tsc --noEmit` before declaring done.

### Known weakness, stated plainly

Inter + a geometric sans + an emerald accent on shadcn defaults is a
competent combination and a common one — it is close to the house style
of AI-generated interfaces. Nothing here is broken, and the tokens are
better thought out than most. But the product does not yet look like
*itself*.

If a distinctive identity is ever commissioned, the place to spend it is
the display face and one structural signature — not more colour, and not
more animation. Until then, do not drift toward the generic default on a
screen-by-screen basis: coherence is worth more than a redesigned corner.
