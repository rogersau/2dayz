# Browser V1 UI Shell Design

## Summary

This spec defines a visual and layout redesign for the browser client on `feature/browser-v1`. The goal is to replace the current centered web-app card treatment with a full-screen game shell that feels closer to a survival game interface while preserving the current browser-first join flow, multiplayer behavior, and gameplay systems.

The redesign should use `Rubik` from Google Fonts, take visual inspiration from Project Zomboid's brutalist utility, and mix in a light worn-survival tone without becoming noisy or unreadable. The browser canvas should own the full viewport, the pre-join experience should read like a game title menu over the live scene, and in-session overlays should feel like game HUD layers rather than website panels.

## Goals

- Make the client feel like a game UI instead of a generic web app.
- Use the full available viewport during both the pre-join and in-session states.
- Keep the name-only join flow and brief controls explanation intact.
- Preserve current gameplay, networking, reconnect behavior, and browser constraints.
- Improve visual cohesion across join, controls, HUD, reconnect, and death states.
- Keep the implementation focused enough to land mostly as UI structure and CSS work.

## Non-Goals

- Changing game rules, combat, inventory logic, or multiplayer behavior.
- Adding new onboarding steps, accounts, or extra required form fields.
- Introducing heavy art pipelines, bespoke illustrations, or large new asset systems.
- Turning the UI into a high-noise distressed mock-horror theme that reduces readability.
- Redesigning unrelated parts of the app outside the browser client shell.

## Design Direction

### Chosen Direction

Use a `strong game shell` approach.

- Base visual language: `brutalist utility`
- Secondary influence: `worn survival tone`
- Avoid: soft rounded cards, marketing-page composition, glossy product UI polish

This means the UI should look structured, practical, and slightly worn rather than elegant or decorative. The framing should suggest functional game panels, status strips, and edge-anchored overlays. Project Zomboid is the aesthetic reference for tone and panel treatment, not a request to clone its interface exactly.

### Core Feel

The browser client should feel like the player has opened a running survival session rather than a landing page. The world should always feel close at hand, with the UI acting as an operational overlay on top of the live scene.

## Visual Language

### Typography

- Replace the current `Inter` stack with `Rubik` loaded from Google Fonts.
- Use `Rubik` across the main shell, menus, labels, buttons, and HUD text.
- Favor strong uppercase micro-labels for metadata and status framing.
- Keep body copy short and practical.

### Palette

Use a muted survival palette with strong contrast.

- Base backgrounds: near-black, charcoal, deep umber
- Primary panel accents: desaturated olive, muddy tan, weathered brass
- Text: warm off-white / bone
- Danger or failure accents: restrained warning red
- Informational accents: subdued steel-blue only where needed for state clarity

The result should feel grounded and worn, not neon or post-apocalyptic comic-book loud.

### Surfaces And Framing

- Replace rounded card language with hard edges or very small corner radii.
- Use framed boxes, inset borders, seam lines, and subtle layered panel treatments.
- Add restrained texture or grain only where it strengthens the survival tone.
- Shadows should read as depth and separation, not soft website elevation.
- Decorative detail should be sparse and repeatable rather than bespoke.

## Layout Model

### Full-Screen Requirement

The app should use the full viewport instead of centering a narrow panel.

- `App` should occupy `100vw` by `100vh` behaviorally, while remaining responsive to browser chrome.
- The game canvas should be treated as the base visual plane.
- Pre-join and in-session states should both use the viewport intentionally rather than collapsing into a boxed center column.

### Primary Structure

The client should have three visual layers:

1. `scene layer`: the live game canvas
2. `shell layer`: title/menu or HUD framing anchored to screen regions
3. `interrupt layer`: connection failure or death state overlays

This keeps the live world present while giving the UI a clear structure.

## Screen States

### Pre-Join Title Menu

The first screen should be a full-screen title/menu overlay placed on top of the live game scene.

Requirements:

- Present the game title prominently.
- Include a short, survival-flavored summary line instead of marketing copy.
- Keep the single required input as `display name`.
- Keep a clear primary action that advances into the live session.
- Make the controls preview visible before play.
- Avoid a modal or centered SaaS-style form card.

The menu can still concentrate its main action in one region of the screen, but the surrounding frame should use the rest of the viewport through background treatment, layout anchors, title treatment, and secondary information blocks.

### Controls Step

The controls explanation should still appear before play, but it should feel like part of the game menu flow rather than a detached website card.

Requirements:

- Show the same compact control set already in scope.
- Preserve the current session-based dismissal behavior.
- Integrate the controls into the full-screen menu shell.
- Keep copy concise and easy to scan.

If the controls step is skipped because it was already dismissed in the current browser session, the transition into join should remain visually coherent.

### In-Session HUD

Once joined, the canvas should own the screen and the HUD should move to edge-anchored screen regions.

Always-visible HUD content:

- health
- ammo
- inventory summary

Additional current metadata such as player and room identifiers may remain available if needed for debugging or implementation continuity, but they should not dominate the layout or read as the primary player-facing HUD language.

HUD principles:

- Prefer top-left, top-right, or lower-edge anchoring over a central card.
- Keep the primary survival information compact and immediately legible.
- Use grouped framed modules rather than floating rounded pills.
- Preserve pointer behavior so interactive HUD panels still work.

### Connection States

Reconnect and failure messaging should become game-state banners or alerts rather than generic status panels.

Requirements:

- Reconnecting state should feel transient and operational.
- Failure state should use a clear warning treatment and retry action.
- Alerts should anchor to an edge or corner and avoid obscuring the entire screen unless necessary.

### Death State

The death overlay should read as a deliberate game-state interruption.

Requirements:

- Use high-contrast framing.
- Keep the message brief.
- Make the respawn expectation clear.
- Visually separate death from ordinary connection or menu states.

## Component-Level Expectations

### `apps/client/src/App.tsx`

- Restructure the top-level shell away from the centered `app-panel` layout.
- Support a full-screen title/menu composition before join.
- Keep the live scene visible behind the menu treatment.
- Preserve the current join, controls, reconnect, and in-session branching logic.

### `apps/client/src/styles.css`

- Carry most of the redesign here.
- Replace the rounded panel system with a harsher, game-like framing system.
- Introduce full-viewport layout rules.
- Define consistent shell, HUD, alert, and overlay visual tokens.
- Include the `Rubik` font import and root font-family update.

### `apps/client/src/game/ui/JoinScreen.tsx`

- Rewrite copy to sound like a game entry point rather than a live-session signup form.
- Keep only the display-name requirement.
- Support full-screen title/menu composition.

### `apps/client/src/game/ui/ControlsOverlay.tsx`

- Present controls as a compact tactical reference.
- Fit the same title/menu shell language used in pre-join.
- Preserve the existing dismissal contract.

### `apps/client/src/game/ui/Hud.tsx`

- Reprioritize visible information around health, ammo, and inventory summary.
- Reduce the feeling of a debugging dashboard.
- Support edge-anchored grouped HUD modules.

### `apps/client/src/game/ui/ConnectionBanner.tsx`

- Convert current banners into game-state alert styling.
- Keep retry behavior unchanged.

### `apps/client/src/game/ui/DeathOverlay.tsx`

- Restyle as a stronger survival-game interruption overlay.
- Keep behavior unchanged.

## Responsive Behavior

The redesign should still work on smaller screens.

- Desktop should use the full viewport with strong edge anchoring.
- Mobile or narrow widths should keep the full-screen feel, but stack or compress shell regions to preserve readability.
- The join flow must remain usable without zooming or horizontal scrolling.
- HUD modules may condense on smaller viewports, but core survival information must stay visible.

## Accessibility And Readability

- Maintain sufficient contrast over the live scene.
- Use overlay backplates, shadows, or dimming where necessary to keep text readable.
- Keep button labels and status labels explicit.
- Avoid texture or decorative noise that makes forms harder to use.

## Error Handling And State Integrity

This redesign must not alter the existing logic contracts for:

- joining
- reconnecting
- retrying failed joins
- controls dismissal in the current session
- death visibility and respawn flow
- inventory toggling

Visual changes can reshape the presentation, but the underlying state transitions must remain intact.

## Testing Strategy

At minimum, validate:

- existing join flow still works end-to-end
- controls step still appears before first join in a session
- controls dismissal still skips repeat acknowledgement in the same session
- reconnect and failure states remain readable and actionable
- HUD remains usable over the live scene
- layout works at desktop and narrow viewport sizes without reverting to a centered website card feel

Use targeted client tests and any existing browser tests that cover join and reconnect behavior. Add or update UI-facing assertions only where the redesign changes render structure in a meaningful way.

## Implementation Boundaries

This redesign should stay intentionally small in scope.

- Prefer targeted JSX reshaping over broad client architecture changes.
- Prefer CSS-led visual transformation over introducing new UI systems.
- Do not add new backend contracts, APIs, or gameplay data for this work.
- Do not add large image assets unless they are clearly necessary and lightweight.

## Acceptance Criteria

- The client uses `Rubik` from Google Fonts.
- The app no longer presents as a centered rounded web card.
- The pre-join experience reads as a full-screen game title/menu over the live scene.
- The UI uses most of the available screen real estate.
- In-session HUD presentation emphasizes health, ammo, and inventory summary.
- Connection and death states feel like in-game overlays rather than website alerts.
- Current join, controls, reconnect, and gameplay behavior remain intact.
