import { z } from "zod";

import { entityIdSchema, roomIdSchema, sessionTokenSchema } from "../ids";
import { serverEventSchema } from "./events";
import { entityDeltaSchema, entitySnapshotSchema, lootEntitySchema, zombieEntitySchema } from "../world/entities";
import { healthSchema, vector2Schema } from "../world/components";
import { inventoryActionSchema, inventorySchema } from "../world/inventory";

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
        fire: z.boolean().optional(),
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
    inventory: inventorySchema,
    health: healthSchema.optional(),
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

export const deltaMessageSchema = z
  .object({
    type: z.literal("delta"),
    tick: z.number().int().nonnegative(),
    roomId: roomIdSchema,
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

export const serverMessageSchema = z.discriminatedUnion("type", [
  roomJoinedMessageSchema,
  snapshotMessageSchema,
  deltaMessageSchema,
]);

export type JoinRequest = z.infer<typeof joinRequestSchema>;
export type ReconnectRequest = z.infer<typeof reconnectRequestSchema>;
export type InputMessage = z.infer<typeof inputMessageSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type PlayerState = z.infer<typeof playerStateSchema>;
export type SnapshotMessage = z.infer<typeof snapshotMessageSchema>;
export type DeltaMessage = z.infer<typeof deltaMessageSchema>;
export type RoomJoinedMessage = z.infer<typeof roomJoinedMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
