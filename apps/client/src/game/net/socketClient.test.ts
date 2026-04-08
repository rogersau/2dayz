import { afterEach, describe, expect, it, vi } from "vitest";

import { inputMessageSchema, roomJoinedMessageSchema, thirdPersonSliceMap } from "@2dayz/shared";

import { createProtocolStore } from "./protocolStore";
import { createSocketClient } from "./socketClient";

const requireAnchor = <T>(anchor: T | undefined, description: string): T => {
  if (!anchor) {
    throw new Error(`${description} missing from thirdPersonSliceMap`);
  }

  return anchor;
};

describe("socketClient", () => {
  const mockSpawn = requireAnchor(
    thirdPersonSliceMap.navigation.nodes.find((node) => node.nodeId === "node_north-lane")?.position,
    "node_north-lane",
  );
  const mockBanditSpawn = requireAnchor(
    thirdPersonSliceMap.navigation.nodes.find((node) => node.nodeId === "node_center-east")?.position,
    "node_center-east",
  );
  const mockZombieSpawn = requireAnchor(
    thirdPersonSliceMap.zombieSpawnZones.find((zone) => zone.zoneId === "zone_north-lane")?.center,
    "zone_north-lane",
  );

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("sends typed input over the active websocket connection after joining", async () => {
    class FakeWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      static instances: FakeWebSocket[] = [];

      readonly listeners = new Map<string, Array<(event?: Event | MessageEvent) => void>>();
      readonly sentMessages: string[] = [];
      readyState = FakeWebSocket.CONNECTING;

      constructor(public readonly url: string) {
        FakeWebSocket.instances.push(this);
      }

      addEventListener(type: string, listener: (event?: Event | MessageEvent) => void, options?: AddEventListenerOptions | boolean) {
        const once = typeof options === "object" && options?.once;
        const wrapped = once
          ? (event?: Event | MessageEvent) => {
            listener(event);
            this.removeEventListener(type, wrapped);
          }
          : listener;
        const handlers = this.listeners.get(type) ?? [];
        handlers.push(wrapped);
        this.listeners.set(type, handlers);
      }

      close() {
        this.readyState = FakeWebSocket.CLOSED;
      }

      dispatch(type: string, event?: Event | MessageEvent) {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }

      emitMessage(data: unknown) {
        this.dispatch("message", { data: JSON.stringify(data) } as MessageEvent);
      }

      open() {
        this.readyState = FakeWebSocket.OPEN;
        this.dispatch("open", new Event("open"));
      }

      removeEventListener(type: string, listener: (event?: Event | MessageEvent) => void) {
        const handlers = this.listeners.get(type) ?? [];
        this.listeners.set(type, handlers.filter((handler) => handler !== listener));
      }

      send(message: string) {
        this.sentMessages.push(message);
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

    const protocolStore = createProtocolStore();
    const socketClient = createSocketClient({
      mode: "ws",
      protocolStore,
      wsUrl: "ws://example.test/ws",
    });
    const joinPromise = socketClient.join({ displayName: "Survivor" });
    const socket = FakeWebSocket.instances[0];

    expect(socket).toBeDefined();
    if (!socket) {
      throw new Error("expected websocket instance");
    }

    socket.open();
    await new Promise((resolve) => setTimeout(resolve, 0));
    socket.emitMessage(roomJoinedMessageSchema.parse({
      type: "room-joined",
      roomId: "room_browser-v1",
      playerEntityId: "player_survivor",
      sessionToken: "session_test",
    }));

    await joinPromise;

    const input = inputMessageSchema.parse({
      actions: { fire: true },
      aim: { x: 14, y: -6 },
      movement: { x: 1, y: 0 },
      sequence: 4,
      type: "input",
    });

    socketClient.sendInput(input);

    expect(socket.sentMessages).toContain(JSON.stringify(input));
  });

  it("applies mock authoritative movement and rotation with the same normalization and aim rules as the server", async () => {
    const protocolStore = createProtocolStore();
    const socketClient = createSocketClient({
      mode: "mock",
      protocolStore,
    });

    await socketClient.join({ displayName: "Survivor" });
    protocolStore.drainWorldUpdates();

    socketClient.sendInput(
      inputMessageSchema.parse({
        actions: {},
        aim: { x: 0, y: 2 },
        movement: { x: 1, y: 1 },
        sequence: 1,
        type: "input",
      }),
    );

    const { deltas } = protocolStore.drainWorldUpdates();
    const selfUpdate = deltas[0]?.entityUpdates.find((update) => update.entityId === "player_survivor");

    expect(selfUpdate).toMatchObject({
      transform: {
        rotation: Math.PI / 2,
        x: mockSpawn.x + 0.1414213562373095,
        y: mockSpawn.y + 0.1414213562373095,
      },
    });
  });

  it("applies mock authoritative equip actions through replicated inventory state", async () => {
    const protocolStore = createProtocolStore();
    const socketClient = createSocketClient({
      mode: "mock",
      protocolStore,
    });

    await socketClient.join({ displayName: "Survivor" });
    protocolStore.drainWorldUpdates();

    socketClient.sendInput(
      inputMessageSchema.parse({
        actions: {
          inventory: {
            type: "equip",
            toSlot: 1,
          },
        },
        aim: { x: 0, y: 0 },
        movement: { x: 0, y: 0 },
        sequence: 2,
        type: "input",
      }),
    );

    const { deltas } = protocolStore.drainWorldUpdates();
    const selfUpdate = deltas[0]?.entityUpdates.find((update) => update.entityId === "player_survivor");

    expect(selfUpdate).toMatchObject({
      inventory: expect.objectContaining({
        ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
        equippedWeaponSlot: 1,
        slots: [
          { itemId: "item_revolver", quantity: 1 },
          { itemId: "item_pipe", quantity: 1 },
          { itemId: "item_bandage", quantity: 1 },
          null,
          null,
          null,
        ],
      }),
      weaponState: expect.objectContaining({
        weaponItemId: "item_pipe",
        weaponType: "melee",
        fireCooldownRemainingMs: 0,
        isBlocking: false,
        isReloading: false,
        magazineAmmo: 0,
        reloadRemainingMs: 0,
      }),
    });
  });

  it("applies mock authoritative stow actions through replicated inventory and weapon state", async () => {
    const protocolStore = createProtocolStore();
    const socketClient = createSocketClient({
      mode: "mock",
      protocolStore,
    });

    await socketClient.join({ displayName: "Survivor" });
    protocolStore.drainWorldUpdates();

    socketClient.sendInput(
      inputMessageSchema.parse({
        actions: {
          inventory: {
            type: "stow",
          },
        },
        aim: { x: 0, y: 0 },
        movement: { x: 0, y: 0 },
        sequence: 3,
        type: "input",
      }),
    );

    const { deltas } = protocolStore.drainWorldUpdates();
    const selfUpdate = deltas[0]?.entityUpdates.find((update) => update.entityId === "player_survivor");

    expect(selfUpdate).toMatchObject({
      inventory: expect.objectContaining({
        equippedWeaponSlot: null,
      }),
      weaponState: expect.objectContaining({
        weaponItemId: "unarmed",
        weaponType: "unarmed",
        isBlocking: false,
      }),
    });
  });

  it("places both mock players and the zombie at exact shared encounter-map positions", async () => {
    const protocolStore = createProtocolStore();
    const socketClient = createSocketClient({ mode: "mock", protocolStore });

    await socketClient.join({ displayName: "Survivor" });

    const { snapshot } = protocolStore.drainWorldUpdates();
    const self = snapshot?.players.find((player) => player.entityId === "player_survivor");
    const bandit = snapshot?.players.find((player) => player.entityId === "player_bandit");
    const zombie = snapshot?.zombies.find((entity) => entity.entityId === "zombie_1");

    expect(snapshot?.players).toHaveLength(2);
    expect(snapshot?.zombies).toHaveLength(1);
    expect(self?.transform).toEqual({ rotation: 0, ...mockSpawn });
    expect(bandit?.transform).toEqual({ rotation: 0.2, ...mockBanditSpawn });
    expect(zombie?.transform).toEqual({ rotation: 0.1, ...mockZombieSpawn });
    expect(self?.inventory).toEqual({
      ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
      equippedWeaponSlot: 0,
      slots: [
        { itemId: "item_revolver", quantity: 1 },
        { itemId: "item_pipe", quantity: 1 },
        { itemId: "item_bandage", quantity: 1 },
        null,
        null,
        null,
      ],
    });
    expect(self).toMatchObject({
      weaponState: {
        weaponItemId: "item_revolver",
        weaponType: "firearm",
        fireCooldownRemainingMs: 0,
        isBlocking: false,
        isReloading: false,
        magazineAmmo: 6,
        reloadRemainingMs: 0,
      },
    });
  });

  it("emits mock combat deltas and eventually removes the mock zombie", async () => {
    const protocolStore = createProtocolStore();
    const socketClient = createSocketClient({ mode: "mock", protocolStore });

    await socketClient.join({ displayName: "Survivor" });
    protocolStore.drainWorldUpdates();

    socketClient.sendInput(inputMessageSchema.parse({
      actions: { fire: true },
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    }));

    const { deltas } = protocolStore.drainWorldUpdates();

    expect(deltas[0]?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "shot", origin: mockSpawn }),
        expect.objectContaining({ type: "combat", targetEntityId: "zombie_1", hitPosition: mockZombieSpawn }),
      ]),
    );

    socketClient.sendInput(inputMessageSchema.parse({
      actions: { fire: true },
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 2,
      type: "input",
    }));
    socketClient.sendInput(inputMessageSchema.parse({
      actions: { fire: true },
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 3,
      type: "input",
    }));
    socketClient.sendInput(inputMessageSchema.parse({
      actions: { fire: true },
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 4,
      type: "input",
    }));

    const removalDelta = protocolStore.drainWorldUpdates().deltas.at(-1);

    expect(removalDelta?.entityUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "zombie_1",
          health: expect.objectContaining({ isDead: true }),
        }),
      ]),
    );
    expect(removalDelta?.removedEntityIds).toEqual(expect.arrayContaining(["zombie_1"]));
  });

  it("does not spend mock ammo or emit a shot event when fire input has zero aim", async () => {
    const protocolStore = createProtocolStore();
    const socketClient = createSocketClient({ mode: "mock", protocolStore });

    await socketClient.join({ displayName: "Survivor" });
    const initialSnapshot = protocolStore.drainWorldUpdates().snapshot;

    socketClient.sendInput(inputMessageSchema.parse({
      actions: { fire: true },
      aim: { x: 0, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    }));

    const delta = protocolStore.drainWorldUpdates().deltas[0];
    const selfUpdate = delta?.entityUpdates.find((update) => update.entityId === "player_survivor");

    expect(delta?.events).toEqual([]);
    expect(selfUpdate?.inventory?.ammoStacks).toEqual(initialSnapshot?.players[0]?.inventory.ammoStacks);
  });

  it("does not treat a melee weapon as a ranged firearm shot", async () => {
    const protocolStore = createProtocolStore();
    const socketClient = createSocketClient({ mode: "mock", protocolStore });

    await socketClient.join({ displayName: "Survivor" });
    protocolStore.drainWorldUpdates();

    socketClient.sendInput(inputMessageSchema.parse({
      actions: {
        inventory: {
          type: "equip",
          toSlot: 1,
        },
      },
      aim: { x: 0, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    }));
    protocolStore.drainWorldUpdates();

    socketClient.sendInput(inputMessageSchema.parse({
      actions: { fire: true },
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 2,
      type: "input",
    }));

    const delta = protocolStore.drainWorldUpdates().deltas[0];
    const selfUpdate = delta?.entityUpdates.find((update) => update.entityId === "player_survivor");

    expect(delta?.events).toEqual([]);
    expect(selfUpdate?.inventory?.ammoStacks).toEqual([{ ammoItemId: "item_pistol-ammo", quantity: 18 }]);
    expect(selfUpdate?.weaponState).toMatchObject({
      weaponItemId: "item_pipe",
      weaponType: "melee",
      magazineAmmo: 0,
    });
  });
});
