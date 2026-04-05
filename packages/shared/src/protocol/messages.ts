import { z } from "zod";

import { entityIdSchema, roomIdSchema, sessionTokenSchema } from "../ids";
import { serverEventSchema } from "./events";
import { entityDeltaSchema, entitySnapshotSchema, lootEntitySchema, zombieEntitySchema } from "../world/entities";
import { healthSchema, transformSchema, vector2Schema, velocitySchema } from "../world/components";
import { inventoryActionSchema, inventorySchema } from "../world/inventory";
import { roomMetadataSchema } from "../world/rooms";

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
    transform: transformSchema,
    velocity: velocitySchema,
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
export type DeltaMessage = z.infer<typeof deltaMessageSchema>;
export type ErrorReason = z.infer<typeof errorReasonSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
export type RoomJoinedMessage = z.infer<typeof roomJoinedMessageSchema>;
export type RoomStatusMessage = z.infer<typeof roomStatusMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
