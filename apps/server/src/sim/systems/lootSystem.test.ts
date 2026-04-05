import { describe, expect, it } from "vitest";

import { createLifecycleSystem } from "./lifecycleSystem";
import { canPlayerPickUpLoot, createLootSystem } from "./lootSystem";
import { createRoomState, queueSpawnPlayer } from "../state";

describe("createLootSystem", () => {
  it("spawns room loot from typed map points and weighted loot tables", () => {
    const state = createRoomState({
      roomId: "room_test",
      world: {
        map: {
          mapId: "map_test",
          name: "Test",
          bounds: { width: 20, height: 20 },
          collisionVolumes: [],
          zombieSpawnZones: [],
          lootPoints: [
            { pointId: "point_loot-a", position: { x: 2, y: 2 }, tableId: "loot_residential" },
            { pointId: "point_loot-b", position: { x: 4, y: 4 }, tableId: "loot_police" },
          ],
          respawnPoints: [],
          interactablePlacements: [],
          navigation: {
            nodes: [{ nodeId: "node_a", position: { x: 1, y: 1 } }],
            links: [{ from: "node_a", to: "node_a", cost: 1 }],
          },
        },
        collision: { volumes: [] },
        navigation: { nodes: new Map(), neighbors: new Map() },
        respawnPoints: [],
      },
    });

    createLootSystem({ random: () => 0 }).update(state, 0);

    expect([...state.loot.values()].map((loot) => ({ itemId: loot.itemId, quantity: loot.quantity, position: loot.position }))).toEqual([
      { itemId: "item_bandage", quantity: 1, position: { x: 2, y: 2 } },
      { itemId: "item_pistol-ammo", quantity: 12, position: { x: 4, y: 4 } },
    ]);
  });

  it("validates loot pickup ownership and proximity before allowing a claim", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-1",
      displayName: "Avery",
      position: { x: 1, y: 1 },
    });
    queueSpawnPlayer(state, {
      entityId: "player_test-2",
      displayName: "Blair",
      position: { x: 10, y: 10 },
    });
    createLifecycleSystem().update(state, 0);

    state.loot.set("loot_test-1", {
      entityId: "loot_test-1",
      itemId: "item_bandage",
      quantity: 1,
      position: { x: 1.5, y: 1 },
      ownerEntityId: "player_test-1",
      sourcePointId: null,
    });

    expect(canPlayerPickUpLoot(state, "player_test-1", "loot_test-1")).toBe(true);
    expect(canPlayerPickUpLoot(state, "player_test-2", "loot_test-1")).toBe(false);

    state.loot.get("loot_test-1")!.ownerEntityId = null;
    expect(canPlayerPickUpLoot(state, "player_test-2", "loot_test-1")).toBe(false);
  });
});
