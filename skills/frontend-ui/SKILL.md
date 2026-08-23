---
name: frontend-ui
description: Build non-ugly HTML/CSS/JS frontends — real layout, typography, color, not default browser blue links. Use for any UI, landing, page, dashboard, or "make a website/page" task.
---

# Frontend UI (not 1995 bare HTML)

## Forbidden (looks broken)
- Naked page: default Times/serif, white background, blue/purple `<a>` list only
- "Welcome to Test Page" / unstyled `<ul><li><a>` skeletons
- System fonts only (Inter, Roboto, Arial, `system-ui` as the whole look)
- Purple-on-white / purple-indigo AI gradient clichés
- Warm cream + terracotta + dense newspaper layout clichés
- Card farm in the hero; emoji as decoration; glow spam

## Required minimum for any HTML page
1. **Own CSS** — either `<style>` in the file or a sibling `.css` linked. No "links only" pages.
2. **Typography** — load one expressive display/body pair (Google Fonts or bundled `@font-face`). Not browser default.
3. **Atmosphere** — background gradient, subtle pattern, or real image plane. Not flat #fff only.
4. **One first-viewport composition** — brand/title, one short line, one CTA group, one visual anchor. Not a dump of links.
5. **Hierarchy** — clear heading sizes, spacing scale, hover/focus states on controls.
6. **Responsive** — usable on narrow screens (flex/grid + media queries).
7. **ASCII UI text** — no emoji in markup/CSS content.

## Layout habits
- Prefer one full-bleed hero section over inset cards for landings.
- Links as designed buttons/nav, not raw underline-blue.
- One job per section: one headline + one short support line.
- Motion: 2–3 intentional transitions max (opacity/transform), not noise.

## Delivery
- Put UI under `projects/<slug>/` if more than one file (`index.html`, `styles.css`, `app.js`).
- One-shot tiny page: still include embedded CSS that looks intentional.
- After write: open path reminder for the user; optional `bash` static check is enough (no need for a browser tool).

## Quick self-check before finishing
- [ ] Would this look OK if the user screenshots it?
- [ ] Is there custom CSS (not browser defaults)?
- [ ] Are fonts non-default?
- [ ] Is the first screen one composition (not a link dump)?
