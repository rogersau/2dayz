import { expect, test } from "@playwright/test";

const combatHud = (page: import("@playwright/test").Page) => page.getByLabel("combat hud");

const installQuickbarSelectionSocketMock = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    let equippedWeaponSlot = 0;

    class MockQuickbarSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readyState = MockQuickbarSocket.CONNECTING;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onopen: ((event: Event) => void) | null = null;

      constructor() {
        super();

        queueMicrotask(() => {
          this.readyState = MockQuickbarSocket.OPEN;
          const event = new Event("open");
          this.onopen?.(event);
          this.dispatchEvent(event);
        });
      }

      close() {
        this.readyState = MockQuickbarSocket.CLOSED;
        const event = new CloseEvent("close", { code: 1000 });
        this.onclose?.(event);
        this.dispatchEvent(event);
      }

      send(data: string) {
        const payload = JSON.parse(data) as {
          actions?: {
            inventory?: { toSlot: number; type: string };
          };
          displayName?: string;
          type: string;
        };

        if (payload.type === "input") {
          if (payload.actions?.inventory?.type !== "equip") {
            return;
          }

          equippedWeaponSlot = payload.actions.inventory.toSlot;
          queueMicrotask(() => {
            const delta = new MessageEvent("message", {
              data: JSON.stringify({
                enteredEntities: [],
                entityUpdates: [
                  {
                    entityId: "player_quickbar-scout",
                    health: { current: 100, isDead: false, max: 100 },
                    inventory: {
                      ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 12 }],
                      equippedWeaponSlot,
                      slots: [
                        { itemId: "weapon_pistol", quantity: 1 },
                        { itemId: "bandage", quantity: 2 },
                        null,
                        null,
                        null,
                        null,
                      ],
                    },
                    lastProcessedInputSequence: 0,
                    weaponState: {
                      fireCooldownRemainingMs: 0,
                      isReloading: false,
                      magazineAmmo: 5,
                      reloadRemainingMs: 0,
                    },
                    transform: { rotation: 0, x: 0, y: 0 },
                    velocity: { x: 0, y: 0 },
                  },
                ],
                events: [],
                removedEntityIds: [],
                roomId: "room_quickbar",
                tick: 2,
                type: "delta",
              }),
            });
            this.onmessage?.(delta);
            this.dispatchEvent(delta);
          });
          return;
        }

        if (payload.type !== "join") {
          return;
        }

        queueMicrotask(() => {
          const roomJoined = new MessageEvent("message", {
            data: JSON.stringify({
              type: "room-joined",
              playerEntityId: "player_quickbar-scout",
              roomId: "room_quickbar",
              sessionToken: "session_quickbar",
            }),
          });
          this.onmessage?.(roomJoined);
          this.dispatchEvent(roomJoined);
        });

        queueMicrotask(() => {
          const snapshot = new MessageEvent("message", {
            data: JSON.stringify({
              loot: [],
              playerEntityId: "player_quickbar-scout",
              players: [
                {
                  displayName: payload.displayName ?? "Quickbar Scout",
                  entityId: "player_quickbar-scout",
                  health: { current: 100, isDead: false, max: 100 },
                  inventory: {
                    ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 12 }],
                    equippedWeaponSlot,
                    slots: [
                      { itemId: "weapon_pistol", quantity: 1 },
                      { itemId: "bandage", quantity: 2 },
                      null,
                      null,
                      null,
                      null,
                    ],
                  },
                  stamina: { current: 10, max: 10 },
                  weaponState: {
                    fireCooldownRemainingMs: 0,
                    isReloading: false,
                    magazineAmmo: 5,
                    reloadRemainingMs: 0,
                  },
                  transform: { rotation: 0, x: 0, y: 0 },
                  velocity: { x: 0, y: 0 },
                },
              ],
              roomId: "room_quickbar",
              tick: 1,
              type: "snapshot",
              zombies: [],
            }),
          });
          this.onmessage?.(snapshot);
          this.dispatchEvent(snapshot);
        });
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      value: MockQuickbarSocket,
    });
  });
};

test("joins from landing page and reaches the game shell", async ({ page }) => {
  await installQuickbarSelectionSocketMock(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "2DayZ" })).toBeVisible();
  await page.getByLabel("Display name").fill("Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();

  await expect(page.getByRole("heading", { name: "Field briefing" })).toBeVisible();
  await page.getByRole("button", { name: "Enter session" }).click();

  await expect(combatHud(page)).toBeVisible();
  await expect(combatHud(page).getByText("Health 100/100")).toBeVisible();
  await expect(combatHud(page).getByText("Ammo 5/12")).toBeVisible();
});

test("keeps the title menu usable on a narrow viewport", async ({ page }) => {
  await installQuickbarSelectionSocketMock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByLabel("title menu")).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review briefing" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByLabel("Display name").fill("Phone Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();

  await expect(page.getByRole("heading", { name: "Field briefing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter session" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Enter session" }).click();
  await expect(combatHud(page)).toBeVisible();
  await expect(page.getByLabel("crosshair")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator(".combat-hud-panel").evaluate((node) => node.getBoundingClientRect().bottom <= window.innerHeight)).toBe(true);
});

test("keeps the joined shell reachable on a shorter phone viewport", async ({ page }) => {
  await installQuickbarSelectionSocketMock(page);
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto("/");

  await page.getByLabel("Display name").fill("Short Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();
  await page.getByRole("button", { name: "Enter session" }).click();

  await expect(combatHud(page)).toBeVisible();
  await expect(page.getByLabel("crosshair")).toBeVisible();
  await expect(page.locator(".combat-hud-panel")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("landing-to-spawn stays under 10 seconds in healthy local conditions", async ({ page }) => {
  await installQuickbarSelectionSocketMock(page);
  const startedAt = Date.now();

  await page.goto("/");
  await page.getByLabel("Display name").fill("Speed Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();
  await page.getByRole("button", { name: "Enter session" }).click();
  await expect(combatHud(page)).toBeVisible();

  const joinDurationMs = Date.now() - startedAt;
  expect(
    joinDurationMs,
    `Landing-to-spawn took ${joinDurationMs}ms, exceeding the 10000ms local target.`,
  ).toBeLessThanOrEqual(10_000);
});

test("health endpoint returns 200 for local verification", async ({ request }) => {
  const response = await request.get("/health");

  expect(response.status()).toBe(200);
  await expect(response).toBeOK();
});

test("reported tick rate stays within the 20-30 Hz target range", async ({ request }) => {
  const response = await request.get("/health");
  const payload = (await response.json()) as { tickRateHz: number };

  expect(payload.tickRateHz).toBeGreaterThanOrEqual(20);
  expect(payload.tickRateHz).toBeLessThanOrEqual(30);
});
