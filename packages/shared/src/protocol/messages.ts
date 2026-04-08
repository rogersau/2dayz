import { z } from "zod";

import { entityIdSchema, roomIdSchema, sessionTokenSchema } from "../ids";
import { serverEventSchema } from "./events";
import { entityDeltaSchema, lootEntitySchema, zombieEntitySchema } from "../world/entities";
import { healthSchema, staminaSchema, transformSchema, vector2Schema, velocitySchema } from "../world/components";
import { inventoryActionSchema, inventorySchema } from "../world/inventory";
import { roomMetadataSchema } from "../world/rooms";
import { weaponStateSchema } from "../world/weapon";

const axisValueSchema = z.number().min(-1).max(1);

export const joinRequestSchema = z
  .object({
    type: z.literal("join"),
    displayName: z.string().trim().min(1).max(24),
  })
  .strict();

export const reconnectRequestSchema = z
  .object({
    type: z.literal("reconnect"),
    sessionToken: sessionTokenSchema,
  })
  .strict();

export const inputMessageSchema = z
  .object({
    type: z.literal("input"),
    sequence: z.number().int().nonnegative(),
    movement: z
      .object({
        x: axisValueSchema,
        y: axisValueSchema,
      })
      .strict(),
    aim: vector2Schema,
    actions: z
      .object({
        aiming: z.boolean().optional(),
        fire: z.boolean().optional(),
        sprint: z.boolean().optional(),
        reload: z.boolean().optional(),
        interact: z.boolean().optional(),
        pickupEntityId: entityIdSchema.optional(),
        inventory: inventoryActionSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const clientMessageSchema = z.discriminatedUnion("type", [
  joinRequestSchema,
  reconnectRequestSchema,
  inputMessageSchema,
]);

export const playerStateSchema = z
  .object({
    entityId: entityIdSchema,
    displayName: z.string().min(1),
    transform: transformSchema,
    velocity: velocitySchema,
    stamina: staminaSchema,
    inventory: inventorySchema,
    lastProcessedInputSequence: z.number().int().nonnegative().optional(),
    health: healthSchema.optional(),
    weaponState: weaponStateSchema.optional(),
  })
  .strict();

export const snapshotMessageSchema = z
  .object({
    type: z.literal("snapshot"),
    tick: z.number().int().nonnegative(),
    roomId: roomIdSchema,
    playerEntityId: entityIdSchema,
    players: z.array(playerStateSchema),
    loot: z.array(lootEntitySchema),
    zombies: z.array(zombieEntitySchema),
  })
  .strict();

export const enteredPlayerSchema = playerStateSchema.extend({
  kind: z.literal("player"),
});

export const enteredLootSchema = lootEntitySchema.extend({
  kind: z.literal("loot"),
});

export const enteredZombieSchema = z
  .object({
    kind: z.literal("zombie"),
    entityId: entityIdSchema,
    archetypeId: z.string().min(1),
    transform: transformSchema,
    velocity: velocitySchema,
    health: healthSchema,
    state: z.enum(["idle", "roaming", "chasing", "attacking", "searching"]),
  })
  .strict();

export const enteredEntitySchema = z.discriminatedUnion("kind", [
  enteredPlayerSchema,
  enteredLootSchema,
  enteredZombieSchema,
]);

export const deltaMessageSchema = z
  .object({
    type: z.literal("delta"),
    tick: z.number().int().nonnegative(),
    roomId: roomIdSchema,
    enteredEntities: z.array(enteredEntitySchema),
    entityUpdates: z.array(entityDeltaSchema),
    removedEntityIds: z.array(entityIdSchema),
    events: z.array(serverEventSchema),
  })
  .strict();

export const roomJoinedMessageSchema = z
  .object({
    type: z.literal("room-joined"),
    roomId: roomIdSchema,
    playerEntityId: entityIdSchema,
    sessionToken: sessionTokenSchema,
  })
  .strict();

export const roomStatusMessageSchema = z
  .object({
    type: z.literal("room-status"),
    room: roomMetadataSchema,
  })
  .strict();

export const errorReasonSchema = z.enum([
  "invalid-message",
  "invalid",
  "expired",
  "not-disconnected",
  "room-unavailable",
  "session-active",
  "internal-error",
]);

export const errorMessageSchema = z
  .object({
    type: z.literal("error"),
    reason: errorReasonSchema,
  })
  .strict();

export const serverMessageSchema = z.discriminatedUnion("type", [
  errorMessageSchema,
  roomJoinedMessageSchema,
  roomStatusMessageSchema,
  snapshotMessageSchema,
  deltaMessageSchema,
]);

export type JoinRequest = z.infer<typeof joinRequestSchema>;
export type ReconnectRequest = z.infer<typeof reconnectRequestSchema>;
export type InputMessage = z.infer<typeof inputMessageSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type PlayerState = z.infer<typeof playerStateSchema>;
export type SnapshotMessage = z.infer<typeof snapshotMessageSchema>;
export type EnteredEntity = z.infer<typeof enteredEntitySchema>;
export type DeltaMessage = z.infer<typeof deltaMessageSchema>;
export type ErrorReason = z.infer<typeof errorReasonSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
export type RoomJoinedMessage = z.infer<typeof roomJoinedMessageSchema>;
export type RoomStatusMessage = z.infer<typeof roomStatusMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
