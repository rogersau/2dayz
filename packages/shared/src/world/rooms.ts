import { z } from "zod";

import { roomIdSchema } from "../ids";

export const roomStatusSchema = z.enum(["booting", "active", "full", "unhealthy", "shutting-down"]);

export const roomMetadataSchema = z
  .object({
    roomId: roomIdSchema,
    name: z.string().min(1),
    status: roomStatusSchema,
    playerCount: z.number().int().nonnegative(),
    capacity: z.number().int().positive(),
  })
  .strict();

export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type RoomMetadata = z.infer<typeof roomMetadataSchema>;
