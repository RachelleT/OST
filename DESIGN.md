# Design System

## Core principle

Each day of the week has its own dominant color. The screen layout stays consistent; only the color changes. This is the entire visual identity of the app.

## Weekly color rotation

Day-to-color is **fixed** (Monday is always teal, Sunday is always amber). The week alternates warm/cool to keep adjacent days distinct.

| Day | Name | Background | Surface (input bg) | Accent (deep) | Text on bg |
|-----|------|------------|--------------------|---------------|-----------|
| Mon | teal   | `#2DBFA8` | `#E1F5EE` | `#04342C` | `#04342C` |
| Tue | coral  | `#FF7A59` | `#FFE0D4` | `#4A1B0C` | `#4A1B0C` |
| Wed | blue   | `#4D96FF` | `#E6F1FB` | `#042C53` | `#042C53` |
| Thu | pink   | `#FF5C8A` | `#FFE6EE` | `#4B1528` | `#4B1528` |
| Fri | green  | `#6FCF4D` | `#EAF3DE` | `#173404` | `#173404` |
| Sat | purple | `#9B7EDC` | `#EEEDFE` | `#26215C` | `#26215C` |
| Sun | amber  | `#F4C77B` | `#F9E0AE` | `#412402` | `#412402` |

Implementation: a `dayPalette(date)` helper returns the palette for a given date. The today screen reads its current day's palette and applies it as CSS variables on the root element. All components reference the variables, not hardcoded hex.

```ts
// Recommended CSS variable names
--day-bg          // dominant background
--day-surface     // input fields, secondary surfaces
--day-accent      // buttons, deep text, streak pill
--day-text-on-bg  // text directly on --day-bg
```

## Decorative shapes

Each daily palette includes 2-3 organic SVG shapes layered behind the content. These are *atmosphere*, not decoration — they make the screen feel composed rather than flat-colored.

Pattern:
- 1 large blob in one corner (uses a darker shade of the day's color)
- 1 softer/lighter shape in the opposite corner (uses a lighter shade)
- 2-3 small dots scattered (one or two use the deep accent color, one uses the light shade)

Shape paths are stored in a `decorativeShapes(palette)` helper. Specific paths used in the mockups are below; the AI builder can refine but should keep the same compositional intent.

Example for Monday (teal):
```jsx
<svg viewBox="0 0 320 580" preserveAspectRatio="xMidYMid slice">
  <path d="M 220 -30 Q 340 0 340 90 Q 340 180 260 170 Q 200 150 210 70 Q 215 10 220 -30 Z" fill="#1D9E75"/>
  <path d="M -30 420 Q 80 380 140 430 Q 200 490 140 530 Q 60 560 -30 530 Q -50 470 -30 420 Z" fill="#7FDDCB"/>
  <circle cx="60" cy="100" r="11" fill="#04342C"/>
  <circle cx="270" cy="380" r="5" fill="#04342C"/>
  <circle cx="180" cy="240" r="4" fill="#7FDDCB"/>
</svg>
```

## Typography

- **Font family**: System sans-serif stack. Use Tailwind's default `font-sans`.
  ```
  ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
  ```
- **Prompt text**: 26px, font-weight 500, letter-spacing -0.5px, line-height 1.2
- **Body text**: 14-16px, font-weight 400, line-height 1.5
- **Small labels** (date, streak, char count): 12-13px, font-weight 500
- **Buttons**: 15px, font-weight 500
- **No serif fonts** in v1. We considered serif for prompts; resolved on sans for a less-precious, more app-y feel.

## Components

### Today screen layout

```
[date · streak pill]               <- top bar, 14px text
[greeting]                         <- "Hey {name} 👋", 13px
[PROMPT]                           <- 26px, the hero
[input card]                       <- surface bg, char counter, photo buttons
[submit button]                    <- accent bg, full width, pill shape
```

All sit on the day's `--day-bg` with decorative shapes behind, content at z-index 1.

### Streak pill

`<div>` with deep accent bg, light text. Shows `🔥 N day streak`. Top right corner. Always visible across all screens that show streak. Tap → goes to history view.

### Input card

- `bg-[var(--day-surface)] rounded-3xl p-4`
- Textarea inside, auto-grows up to ~6 lines then scrolls
- Bottom row: photo/camera icons left, char counter right
- Photo icons are pills (36px circles, day-bg color) with the day's accent for the icon itself

### Submit button

- Full width, `bg-[var(--day-accent)] text-[var(--day-surface)]`
- Pill shape, 15px font, 15px padding
- Disabled state when input is empty AND no photo
- Tap state: scale-down briefly (Framer Motion `whileTap`)

### Bottom nav (only on logged-in screens, not onboarding)

Three tabs: Today, History, You.
- Active tab: solid accent text + icon
- Inactive: muted (50% opacity of accent)
- Today tab is the home/default

## States

### Today empty (no post yet)
Full color background, prompt, empty input with placeholder text, disabled-ish submit button.

### Today completed (already posted)
Same color background. Replace input with the user's posted text in a white card. Show "Done for today" green pill. Add a "See you tomorrow" card at the bottom with the next reminder time.

### Today missed grace consumed
Same as completed but with a one-time toast: "We used your grace day for [date] — streak safe".

### History
A separate visual surface — neutral background (`#F1EFE8`-ish), not the day's color. Shows stats grid (total posts, longest streak, current streak), a 6-week heatmap calendar where each day's square is colored using that day's palette accent, and a scrollable list of recent posts.

### Admin dashboard
Also neutral background. Lists posts with their share permission badges. No daily color applied here — admin is a tool, not a moment.

## Animation

Use Framer Motion. Keep it subtle.

- Page transitions: 200ms fade + 8px slide-up
- Streak count-up on successful post: spring animation from old → new value
- Decorative shapes: slow drift (1% movement over 8s, ease-in-out, infinite alternate). Disabled if `prefers-reduced-motion` is set.
- Submit button tap: `whileTap={{ scale: 0.97 }}`

## Accessibility

- All text on day backgrounds must hit 4.5:1 contrast minimum. The accent colors in the table above were chosen to pass against their background. Verify with tools/axe in CI.
- All interactive elements keyboard-focusable with visible focus ring (2px outline, accent color, 2px offset)
- Photo and camera icon buttons have `aria-label`
- Streak pill has `aria-label="12 day streak"` (number spelled into the label)
- Form inputs have associated labels (visually hidden where needed)
- Respect `prefers-reduced-motion` for all animations
- Color is never the only signifier (e.g., the "done for today" pill has a check icon AND green AND text)
