# 2dayz

Install dependencies with `pnpm install`.

Local run steps:

1. Install dependencies: `pnpm install`
2. Start the browser client: `pnpm dev:client`
3. Start the game server: `pnpm dev:server`
4. Open `http://127.0.0.1:3201`, enter a display name, accept the controls overlay, and wait for the in-game HUD.

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
