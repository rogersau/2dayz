import { expect, test } from "@playwright/test";

const serverPort = Number(process.env.PORT ?? 3201);

const installReconnectSocketMock = async (context: import("@playwright/test").BrowserContext) => {
  await context.addInitScript(() => {
    class MockReconnectSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      static reconnectAttempts = 0;

      readyState = MockReconnectSocket.CONNECTING;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onopen: ((event: Event) => void) | null = null;

      constructor() {
        super();

        queueMicrotask(() => {
          this.readyState = MockReconnectSocket.OPEN;
          const event = new Event("open");
          this.onopen?.(event);
          this.dispatchEvent(event);
        });
      }

      close() {
        this.readyState = MockReconnectSocket.CLOSED;
        const event = new CloseEvent("close", { code: 1000 });
        this.onclose?.(event);
        this.dispatchEvent(event);
      }

      send(data: string) {
        const payload = JSON.parse(data) as { type: string; sessionToken?: string };

        if (payload.type === "join") {
          queueMicrotask(() => {
            const event = new MessageEvent("message", {
              data: JSON.stringify({
                type: "room-joined",
                playerEntityId: "player_reconnect-scout",
                roomId: "room_reconnect",
                sessionToken: "session_reconnect",
              }),
            });
            this.onmessage?.(event);
            this.dispatchEvent(event);
          });
          return;
        }

        if (payload.type !== "reconnect") {
          return;
        }

        MockReconnectSocket.reconnectAttempts += 1;

        queueMicrotask(() => {
          const event = new MessageEvent("message", {
            data: JSON.stringify(
              MockReconnectSocket.reconnectAttempts === 1
                ? { type: "error", reason: "not-disconnected" }
                : {
                    type: "room-joined",
                    playerEntityId: "player_reconnect-scout",
                    roomId: "room_reconnect",
                    sessionToken: payload.sessionToken ?? "session_reconnect",
                  },
            ),
          });
          this.onmessage?.(event);
          this.dispatchEvent(event);
        });
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      value: MockReconnectSocket,
    });
  });
};

const installExpiredReconnectSocketMock = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    class MockExpiredSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readyState = MockExpiredSocket.CONNECTING;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onopen: ((event: Event) => void) | null = null;

      constructor() {
        super();

        queueMicrotask(() => {
          this.readyState = MockExpiredSocket.OPEN;
          const event = new Event("open");
          this.onopen?.(event);
          this.dispatchEvent(event);
        });
      }

      close() {
        this.readyState = MockExpiredSocket.CLOSED;
        const event = new CloseEvent("close", { code: 1000 });
        this.onclose?.(event);
        this.dispatchEvent(event);
      }

      send(data: string) {
        const payload = JSON.parse(data) as { type: string };
        if (payload.type !== "reconnect") {
          return;
        }

        queueMicrotask(() => {
          const event = new MessageEvent("message", {
            data: JSON.stringify({ type: "error", reason: "invalid" }),
          });
          this.onmessage?.(event);
          this.dispatchEvent(event);
        });
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      value: MockExpiredSocket,
    });
  });
};

const joinIntoHud = async (page: import("@playwright/test").Page, displayName: string) => {
  await page.goto("/");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue to session" }).click();
  await expect(page.getByRole("heading", { name: "Session HUD" })).toBeVisible();
};

const readSessionHud = async (page: import("@playwright/test").Page) => {
  const playerText = await page.getByText(/^Player:/).textContent();
  const roomText = await page.getByText(/^Room:/).textContent();

  return {
    player: playerText?.replace(/^Player:\s*/, "") ?? "",
    room: roomText?.replace(/^Room:\s*/, "") ?? "",
  };
};

const connectPlayer = async (displayName: string) => {
  return await new Promise<{ close: () => void; roomId: string }>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out joining as ${displayName}.`));
    }, 5_000);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "join", displayName }));
    }, { once: true });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { type: string; roomId?: string };
      if (message.type !== "room-joined" || !message.roomId) {
        return;
      }

      clearTimeout(timer);
      resolve({
        close: () => socket.close(),
        roomId: message.roomId,
      });
    });

    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`WebSocket join failed for ${displayName}.`));
    }, { once: true });
  });
};

test("reconnects inside the reclaim window using the stored session token", async ({ context, page }) => {
  await installReconnectSocketMock(context);
  await joinIntoHud(page, "Reconnect Scout");
  const sessionBeforeReconnect = await readSessionHud(page);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Session HUD" })).toBeVisible();

  await expect.poll(() => readSessionHud(page)).toEqual(sessionBeforeReconnect);
});

test("reconnect completes in under 5 seconds during the reclaim window", async ({ context, page }) => {
  await installReconnectSocketMock(context);
  await joinIntoHud(page, "Fast Reconnect Scout");

  const startedAt = Date.now();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Session HUD" })).toBeVisible();

  const reconnectDurationMs = Date.now() - startedAt;
  expect(
    reconnectDurationMs,
    `Reconnect took ${reconnectDurationMs}ms, exceeding the 5000ms reclaim-window target.`,
  ).toBeLessThanOrEqual(5_000);
});

test("falls back to a fresh run after an expired stored token", async ({ page }) => {
  await installExpiredReconnectSocketMock(page);
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem("2dayz:display-name", "Expired Scout");
    window.sessionStorage.setItem("2dayz:session-token", "session_missing");
  });

  await page.reload();

  await expect(page.getByText("Your previous session expired. Retry to enter a fresh run.")).toBeVisible();
  await page.getByRole("button", { name: "Retry join" }).click();
  await expect(page.getByRole("heading", { name: "Join a live session" })).toBeVisible();
  await expect(page.getByLabel("Display name")).toHaveValue("Expired Scout");
});

test("shows retryable join failure messaging for unavailable rooms", async ({ page }) => {
  await page.addInitScript(() => {
    class MockJoinFailureSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readyState = MockJoinFailureSocket.CONNECTING;
      url: string;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onopen: ((event: Event) => void) | null = null;

      constructor(url: string) {
        super();
        this.url = url;

        queueMicrotask(() => {
          this.readyState = MockJoinFailureSocket.OPEN;
          const event = new Event("open");
          this.onopen?.(event);
          this.dispatchEvent(event);
        });
      }

      close() {
        this.readyState = MockJoinFailureSocket.CLOSED;
        const event = new CloseEvent("close", { code: 1000 });
        this.onclose?.(event);
        this.dispatchEvent(event);
      }

      send(data: string) {
        const payload = JSON.parse(data) as { type: string };
        if (payload.type !== "join") {
          return;
        }

        queueMicrotask(() => {
          const event = new MessageEvent("message", {
            data: JSON.stringify({ type: "error", reason: "room-unavailable" }),
          });
          this.onmessage?.(event);
          this.dispatchEvent(event);
        });
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      value: MockJoinFailureSocket,
    });
  });

  await page.goto("/");
  await page.getByLabel("Display name").fill("Fail Room");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue to session" }).click();

  await expect(
    page.getByText("The room was unavailable or unhealthy. Retry to join a healthy session."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry join" })).toBeVisible();
});

test("routes the thirteenth synthetic join into a new room after the 12-player cap", async () => {
  const connections = [] as Array<{ close: () => void; roomId: string }>;

  for (let index = 0; index < 13; index += 1) {
    connections.push(await connectPlayer(`Cap Scout ${index + 1}`));
  }

  try {
    const roomCounts = connections.reduce((counts, connection) => {
      counts.set(connection.roomId, (counts.get(connection.roomId) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());

    expect(roomCounts.size).toBeGreaterThanOrEqual(2);
    expect(Math.max(...roomCounts.values())).toBeLessThanOrEqual(12);
  } finally {
    for (const connection of connections) {
      connection.close();
    }
  }
});
