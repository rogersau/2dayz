import { describe, expect, it } from "vitest";

import { entityKindSchema } from "../world/entities";
import {
  combatEventSchema,
  clientMessageSchema,
  deathEventSchema,
  reconnectRequestSchema,
  serverMessageSchema,
} from "./schemas";

describe("protocol schemas", () => {
  it("parses valid join, reconnect, and input client payloads", () => {
    expect(
      clientMessageSchema.parse({
        type: "join",
        displayName: "Survivor",
      }),
    ).toMatchObject({ type: "join", displayName: "Survivor" });

    expect(
      reconnectRequestSchema.parse({
        type: "reconnect",
        sessionToken: "session_123",
      }),
    ).toMatchObject({ type: "reconnect", sessionToken: "session_123" });

    expect(
      clientMessageSchema.parse({
        type: "input",
        sequence: 17,
        movement: { x: 1, y: -1 },
        aim: { x: 0.25, y: 0.75 },
        actions: {
          fire: true,
          reload: false,
          interact: true,
          pickupEntityId: "loot_001",
        },
      }),
    ).toMatchObject({ type: "input", sequence: 17 });
  });

  it("parses valid snapshot, delta, and death server payloads", () => {
    expect(
      serverMessageSchema.parse({
        type: "snapshot",
        tick: 25,
        roomId: "room_alpha",
        playerEntityId: "player_1",
        players: [
          {
            entityId: "player_1",
            displayName: "Survivor",
            inventory: {
              slots: [
                { itemId: "bandage", quantity: 1 },
                { itemId: "m9", quantity: 1 },
                null,
                null,
                null,
                null,
              ],
              equippedWeaponSlot: 1,
              ammoStacks: [
                { ammoItemId: "9mm-rounds", quantity: 12 },
              ],
            },
          },
        ],
        loot: [
          {
            entityId: "loot_001",
            itemId: "bandage",
            quantity: 1,
            position: { x: 8, y: 4 },
          },
        ],
        zombies: [
          {
            entityId: "zombie_1",
            archetypeId: "walker",
            transform: { x: 12, y: 6, rotation: 0 },
            state: "chasing",
          },
        ],
      }),
    ).toMatchObject({ type: "snapshot", tick: 25, roomId: "room_alpha" });

    expect(
      serverMessageSchema.parse({
        type: "delta",
        tick: 26,
        roomId: "room_alpha",
        entityUpdates: [
          {
            entityId: "player_1",
            transform: { x: 11, y: 5, rotation: 1.2 },
            velocity: { x: 1, y: 0 },
          },
        ],
        removedEntityIds: ["loot_001"],
        events: [
          {
            type: "loot-picked-up",
            entityId: "loot_001",
            pickerEntityId: "player_1",
            itemId: "bandage",
            quantity: 1,
          },
        ],
      }),
    ).toMatchObject({ type: "delta", tick: 26 });

    expect(
      combatEventSchema.parse({
        type: "combat",
        roomId: "room_alpha",
        attackerEntityId: "player_1",
        targetEntityId: "zombie_1",
        weaponItemId: "m9",
        damage: 18,
        remainingHealth: 42,
        hitPosition: { x: 12, y: 6 },
      }),
    ).toMatchObject({ type: "combat", damage: 18, weaponItemId: "m9" });

    expect(
      deathEventSchema.parse({
        type: "death",
        victimEntityId: "player_1",
        killerEntityId: "zombie_1",
        roomId: "room_alpha",
        droppedInventory: {
          slots: [
            { itemId: "bandage", quantity: 1 },
            null,
            null,
            null,
            null,
            null,
          ],
          equippedWeaponSlot: null,
          ammoStacks: [],
        },
        respawnAt: { x: 2, y: 3 },
      }),
    ).toMatchObject({ type: "death", victimEntityId: "player_1" });
  });

  it("rejects invalid payloads", () => {
    expect(() =>
      clientMessageSchema.parse({
        type: "join",
        displayName: "",
      }),
    ).toThrow();

    expect(() =>
      reconnectRequestSchema.parse({
        type: "reconnect",
        sessionToken: "",
      }),
    ).toThrow();

    expect(() =>
      clientMessageSchema.parse({
        type: "input",
        sequence: -1,
        movement: { x: 3, y: 0 },
        aim: { x: 0, y: 0 },
        actions: {},
      }),
    ).toThrow();

    expect(() =>
      serverMessageSchema.parse({
        type: "snapshot",
        tick: 1,
        roomId: "room_alpha",
        playerEntityId: "player_1",
        entities: [],
        players: [],
        loot: [],
      }),
    ).toThrow();

    expect(() =>
      serverMessageSchema.parse({
        type: "snapshot",
        tick: 1,
        roomId: "room_alpha",
        playerEntityId: "player_1",
        entities: [],
        players: [],
        loot: [],
        zombies: [],
      }),
    ).toThrow();

    expect(() =>
      serverMessageSchema.parse({
        type: "snapshot",
        tick: 1,
        roomId: "room_alpha",
        playerEntityId: "player_1",
        entities: [],
        players: [
          {
            entityId: "player_1",
            displayName: "Survivor",
            sessionToken: "session_123",
            inventory: {
              slots: [null, null, null, null, null, null],
              equippedWeaponSlot: null,
              ammoStacks: [],
            },
          },
        ],
        loot: [],
        zombies: [],
      }),
    ).toThrow();

    expect(() =>
      serverMessageSchema.parse({
        type: "delta",
        tick: 1,
        roomId: "room_alpha",
        entityUpdates: [
          {
            entityId: "player_1",
          },
        ],
        removedEntityIds: [],
        events: [],
      }),
    ).toThrow();

    expect(() =>
      deathEventSchema.parse({
        type: "death",
        victimEntityId: "player_1",
        killerEntityId: null,
        roomId: "room_alpha",
        droppedInventory: {
          slots: [],
          equippedWeaponSlot: 99,
          ammoStacks: [],
        },
        respawnAt: { x: 2 },
      }),
    ).toThrow();

    expect(() =>
      combatEventSchema.parse({
        type: "combat",
        roomId: "room_alpha",
        attackerEntityId: "player_1",
        targetEntityId: "zombie_1",
        weaponItemId: "m9",
        damage: 0,
        remainingHealth: -1,
        hitPosition: { x: 12 },
      }),
    ).toThrow();

    expect(() => entityKindSchema.parse("projectile")).toThrow();
    expect(() => entityKindSchema.parse("prop")).toThrow();
  });
});
