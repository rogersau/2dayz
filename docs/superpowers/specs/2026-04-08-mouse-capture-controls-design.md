# Mouse Capture Controls Design

## Summary

Align third-person controls with the intended mouse-driven play model: mouse look should work whenever the game has captured the pointer, left click should fire, right click should toggle the tighter aiming posture, and `Escape` should reliably release mouse capture and return the cursor to the browser.

This change is intentionally narrow. It only adjusts input capture, aim-mode behavior, and the user-facing control copy needed to make those rules understandable.

## Goals

- Make mouse look work without requiring right mouse to be held first.
- Preserve a distinct tighter aim posture on right mouse.
- Ensure players can always release mouse capture with `Escape`.
- Keep pointer-lock loss from leaving stale fire or aim state behind.
- Make the on-screen controls copy match actual runtime behavior.

## Non-Goals

- Changing server-side combat rules.
- Redesigning camera math beyond capture and aim-mode gating.
- Adding gamepad support.
- Adding a complex settings UI for rebinding controls.

## Control Model

- First gameplay click captures the mouse.
- While the mouse is captured, mouse movement always controls camera yaw and pitch.
- `Left click` fires the primary weapon.
- `Right click` enables the tighter over-the-shoulder aiming posture.
- Native `Escape` releases pointer lock and returns to free-cursor mode.

This keeps the control model consistent with the user expectation of `Mouse aim` while retaining a deliberate aim modifier for the tighter combat camera.

## Input State Design

The runtime should treat pointer capture and aiming as separate states.

- `isPointerCaptured`: whether pointer lock is currently active for the game canvas.
- `isAiming`: whether right mouse is currently held for the tighter aim posture.
- `isFiring`: whether left mouse is currently held.

Mouse look depends on `isPointerCaptured`, not on `isAiming`. This is the key behavioral change. Right mouse should no longer be the gate that makes mouse look function at all.

## Capture Lifecycle

### Entering capture

- Any gameplay click on the game canvas may request pointer lock.
- The first common path should be left click, since players naturally click before trying to move the camera or fire.
- Right click should also continue to work if it is the first interaction.

### While captured

- `mousemove` deltas update yaw and pitch whenever pointer lock is active.
- Left mouse can fire whether or not right mouse is held.
- Right mouse only changes aim posture and any camera tightening tied to it.

### Leaving capture

- `Escape` should release pointer lock through the browser's native behavior.
- Any pointer-lock loss event must clear `isAiming`.
- Pointer-lock loss should also leave firing in a safe state so the client does not keep sending held-fire after the cursor has been released.
- Blur and hidden-visibility paths should continue to clear latched input as they already do.

## Camera And Combat Behavior

- The chase camera should continue to follow yaw and pitch whenever the mouse is captured.
- The tighter over-the-shoulder framing should remain tied to `isAiming`.
- Local predicted facing should continue using the current aim vector from yaw.
- No additional changes are required to shot authority or aim-vector contracts as part of this control update.

## UI Copy

The controls overlay should be updated so it no longer promises behavior that the runtime does not implement.

Recommended copy:

- `Click to capture mouse`
- `Mouse aim`
- `Left click fire`
- `Right click aim`
- `Esc release mouse`
- `WASD move`
- `E interact`
- `R reload`
- `Tab inventory`

## Error Handling And State Integrity

- Losing pointer lock by `Escape`, browser action, or focus change must exit aim cleanly.
- Input polling after pointer-lock loss must not report stale `aiming` or stale held-fire state.
- Disabled or unjoined game state must still reject capture-driven gameplay input.

## Testing Strategy

Implementation should extend the existing input controller tests with regression coverage for:

- left click requesting pointer lock when gameplay input is enabled
- document-level mouse movement updating yaw and pitch after left-click capture
- right click toggling aim posture independently of whether capture is already active
- pointer-lock loss clearing aim and held-fire state
- `Escape`/pointer-lock exit returning the controller to uncaptured free-cursor behavior
- controls overlay copy matching the implemented mouse-capture model

## Implementation Boundaries

- Keep the change localized to the client input controller, related tests, and control-copy UI.
- Do not introduce a settings system or alternate capture modes in this pass.
- Prefer small changes to existing input lifecycle code over adding a new abstraction layer.
