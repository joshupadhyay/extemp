# Extemp — Design System

## Style

Minimalism & Swiss with Brutalist accents. Monochrome palette, single red accent for CTAs. Inter for body, system monospace for labels/stats/timers. Reference: `assets/design-*.html`.

---

## Color Tokens

| Token | Value | CSS Variable | Usage |
|---|---|---|---|
| Background | `#FFFFFF` | `--background` | Page background |
| Background subtle | `#FAFAFA` | `--bg-subtle` | Cards, panels |
| Text | `#111111` | `--foreground` | Primary text |
| Text muted | `#888888` | `--muted-foreground` | Labels, timestamps, secondary |
| Hairline | `#E5E5E5` | `--border` | Borders, dividers |
| Accent (CTA) | `#DC2626` | `--cta` | Red CTA buttons only |
| Accent hover | `#B91C1C` | `--cta-hover` | CTA hover state |
| Accent soft | `#FEF2F2` | `--cta-soft` | Score badges, subtle highlights |
| Success | `#16A34A` | `--success` | Positive indicators |
| Warning | `#D97706` | `--warning` | Filler word highlights |

**Contrast checks:**
- Text (#111) on Background (#FFF): **15.9:1** — AAA
- White on CTA red (#DC2626): **4.63:1** — AA
- CTA red on Background (#FFF): **4.65:1** — AA

---

## Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
```

| Role | Font | Weight | Mobile | Desktop | Line Height |
|---|---|---|---|---|---|
| H1 (page title) | Inter | 500 | 1.75rem | 2.5rem | 1.1 |
| H2 (section label) | System mono | 500 | 0.7rem | 0.7rem | 1 |
| Body | Inter | 400 | 1rem | 1.1rem | 1.6 |
| Coach prose | Inter | 400 | 1rem | 1.05rem | 1.7 |
| Stats/labels | System mono | 400 | 0.75rem | 0.8rem | 1.4 |
| Timer digits | System mono | 600 | 3rem | 4rem | 1 |

H2 section labels are always uppercase with `letter-spacing: 0.1em` (matches reference `.section-label` pattern).

Monospace stack: `'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace`

---

## Spacing

Base unit: 8px. All spacing in multiples.

| Token | Value | Usage |
|---|---|---|
| `--pad` | 40px (desktop) / 20px (mobile) | Page padding |
| Section gap | 64px (desktop) / 40px (mobile) | Between major sections |
| Component gap | 24px | Between related elements |
| Inner padding | 16px–20px | Card/panel padding |

---

## Breakpoints

| Name | Width | Key Change |
|---|---|---|
| Mobile | < 768px | Single column, full-width CTAs |
| Tablet | 768px–1023px | Minor spacing increases |
| Desktop | 1024px+ | Split panels activate on Landing + Results |

---

## Responsive Split Panel

Only used on Landing and Results pages at `1024px+`.

```css
/* Desktop */
.split-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 100dvh;
}

/* Mobile — stacks vertically */
@media (max-width: 1023px) {
  .split-panel {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 100dvh;
  }
}
```

Practice page is always single-column centered (`max-width: 640px`).

---

## Components

### CTA Button (Red)

One red button per view. Everything else is ghost/outline.

```
- Min height: 44px (touch target)
- Padding: 12px 32px (desktop), full-width on mobile
- Background: var(--cta), hover: var(--cta-hover)
- Text: white, font-weight: 500
- Transition: background-color 200ms ease-out
- Focus: ring-2 ring-red-600 ring-offset-2
- No border-radius (brutalist, matches reference)
```

### Section Label (Mono)

```
- Font: monospace, 0.7rem, uppercase
- Letter-spacing: 0.1em
- Color: var(--muted-foreground)
- Margin-bottom: 24px
```

Pattern: `PREP TIME`, `RECORDING`, `FRAMEWORK DETECTED`, `SCORE`

### Cards (History)

```
- Border: 1px solid var(--border)
- No border-radius (brutalist)
- Padding: 16px 20px
- Hover: background var(--bg-subtle), 200ms ease-out
- Cursor: pointer
```

### Timer

```
- Font: monospace, 600 weight
- Size: 3rem mobile / 4rem desktop
- Color: var(--foreground)
- Centered in view
- Progress bar below: 2px height, var(--border) track, var(--foreground) fill
- Recording state: red dot pulsing (opacity only, 1s ease-in-out)
```

### Quick Stats Bar

```
- Horizontal row of dimension scores
- Font: monospace, 0.8rem
- Each: label + number, separated by hairlines
- Mobile: wraps to 2 rows of 3
```

---

## Animation

| Element | Property | Duration | Easing |
|---|---|---|---|
| Scramble text (landing) | innerHTML | ~40 frames | rAF |
| Recording dot | opacity 1→0.3 | 1s | ease-in-out, infinite |
| Timer progress | transform: scaleX() | per-second | linear |
| Processing skeleton | background-position | 1.5s | ease-in-out, infinite |
| Page transitions | opacity | 200ms | ease-out |
| Button hover | background-color | 200ms | ease-out |

All animations gated: `@media (prefers-reduced-motion: no-preference)`.

---

## Mobile-Specific Rules

- Kill custom cursor on touch: `@media (hover: hover)` guard
- Use `100dvh` not `100vh`
- Body scrolls (no `overflow: hidden`)
- Corner markers: hidden on mobile
- ASCII/waveform: compact 120px banner or hidden
- CTA buttons: full-width below 768px
- Touch targets: minimum 44x44px, 8px gap between adjacent targets

---

## Icon Set

Lucide React (already installed). SVG only — no emojis as UI icons.

---

## Pre-Delivery Checklist

```
- [ ] No emojis as icons (Lucide SVGs only)
- [ ] All clickable elements have cursor-pointer
- [ ] Hover transitions: 150-300ms, no layout shift
- [ ] White on red contrast >= 4.5:1
- [ ] Focus states: ring-2 ring-offset-2 on all interactive elements
- [ ] No content behind fixed elements
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile
- [ ] Touch targets >= 44px
- [ ] prefers-reduced-motion respected
- [ ] 100dvh not 100vh
- [ ] Custom cursor disabled on touch
- [ ] Section labels use mono uppercase pattern
- [ ] Only one red CTA per view
```
