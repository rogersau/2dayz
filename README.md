# 2dayz

Install dependencies with `pnpm install`.

Local run steps:

1. Install dependencies: `pnpm install`
2. Start everything together: `pnpm dev`
3. The client browser opens automatically at `http://127.0.0.1:3200`
4. The game server runs on `http://127.0.0.1:3201`
5. Enter a display name, accept the controls overlay, and wait for the in-game HUD.

Verification commands:

- `pnpm lint`
- `pnpm test`
- `pnpm e2e`
- `pnpm verify:health`
- `pnpm verify:room-cap`
- `pnpm verify:join-time`
- `pnpm verify:reconnect-time`
- `pnpm verify:tick-rate`
- `pnpm verify:room-isolation`
- `pnpm build`

The local reference thresholds are enforced by the verification scripts:

- health endpoint must return `200`
- room cap must create more than one room under `13` synthetic joins, and no room may exceed `12` players
- landing-to-spawn time must stay at or below `10000ms`
- reconnect time inside the reclaim window must stay at or below `5000ms`
- reported tick rate must stay within `20-30 Hz`

Expected workspace layout:

- `apps/client` for the browser client
- `apps/server` for the authoritative game server
- `packages/shared` for shared TypeScript contracts and content schemas
