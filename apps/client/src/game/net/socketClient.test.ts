import { describe, expect, it, vi } from "vitest";

import { createProtocolStore } from "./protocolStore";
import { createSocketClient } from "./socketClient";

describe("socketClient", () => {
  it("rejects a second in-flight request while a join is already pending", async () => {
    const socketClient = createSocketClient({
      mode: "mock",
      protocolStore: createProtocolStore(),
    });

    const firstJoin = socketClient.join({ displayName: "Survivor" });

    await expect(socketClient.reconnect({ sessionToken: "session_test" })).rejects.toMatchObject({
      reason: "session-active",
    });

    await expect(firstJoin).resolves.toMatchObject({
      playerEntityId: "player_survivor",
      roomId: "room_browser-v1",
    });
  });
});
