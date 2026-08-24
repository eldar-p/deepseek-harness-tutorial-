---
name: frontend-ui
description: Build intentional HTML/CSS/JS — typography, layout, atmosphere. Not default browser blue links.
---

# Frontend UI (GIM workspace)

Deliver under workspace, e.g. `my-app/` or `ui/` — guest path `/workspace/my-app/`.

## Forbidden (looks broken)

- Default Times + white + blue/purple `<a>` list only
- Unstyled link dumps as the whole page
- Purple-indigo AI gradient clichés as the only design
- Emoji as decoration in markup

## Required minimum

1. **Own CSS** — linked file or intentional `<style>`
2. **Typography** — non-default font pair (Google Fonts or `@font-face`)
3. **Atmosphere** — gradient, pattern, or image plane (not flat #fff only)
4. **One hero composition** — title, one line, one CTA group
5. **Hierarchy** — spacing scale, hover/focus states
6. **Responsive** — flex/grid + media queries
7. **ASCII UI text** in content

## Delivery

- Multi-file: `index.html`, `styles.css`, `app.js` in one project folder
- After write: suggest `guest_bash` static check or open via GIM UI file browser
- Static preview: user opens GIM UI or local file — no special browser tool required

## Self-check

- [ ] Custom CSS (not browser defaults)?
- [ ] Non-default fonts?
- [ ] First screen is one composition, not a link dump?
