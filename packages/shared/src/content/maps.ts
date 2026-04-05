import { z } from "zod";

import { lootTableIdSchema, mapIdSchema, nodeIdSchema, placementIdSchema, pointIdSchema, volumeIdSchema } from "../ids";
import { zombieSpawnZoneSchema, respawnPointSchema } from "./spawns";
import { vector2Schema } from "../world/components";

export const collisionVolumeSchema = z
  .object({
    volumeId: volumeIdSchema,
    kind: z.enum(["box", "circle"]),
    position: vector2Schema,
    size: z
      .object({
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict(),
  })
  .strict();

export const lootPointSchema = z
  .object({
    pointId: pointIdSchema,
    position: vector2Schema,
    tableId: lootTableIdSchema,
  })
  .strict();

export const interactablePlacementSchema = z
  .object({
    placementId: placementIdSchema,
    kind: z.enum(["door", "crate", "stash", "terminal"]),
    position: vector2Schema,
    interactionRadius: z.number().positive(),
    prompt: z.string().min(1),
  })
  .strict();

export const navigationNodeSchema = z
  .object({
    nodeId: nodeIdSchema,
    position: vector2Schema,
  })
  .strict();

export const navigationLinkSchema = z
  .object({
    from: nodeIdSchema,
    to: nodeIdSchema,
    cost: z.number().positive(),
  })
  .strict();

export const navigationDataSchema = z
  .object({
    nodes: z.array(navigationNodeSchema).min(1),
    links: z.array(navigationLinkSchema).min(1),
  })
  .strict();

export const mapDefinitionSchema = z
  .object({
    mapId: mapIdSchema,
    name: z.string().min(1),
    bounds: z
      .object({
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict(),
    collisionVolumes: z.array(collisionVolumeSchema).min(1),
    zombieSpawnZones: z.array(zombieSpawnZoneSchema).min(1),
    lootPoints: z.array(lootPointSchema).min(1),
    respawnPoints: z.array(respawnPointSchema).min(1),
    interactablePlacements: z.array(interactablePlacementSchema).min(1),
    navigation: navigationDataSchema,
  })
  .strict();

export type CollisionVolume = z.infer<typeof collisionVolumeSchema>;
export type InteractablePlacement = z.infer<typeof interactablePlacementSchema>;
export type LootPoint = z.infer<typeof lootPointSchema>;
export type NavigationNode = z.infer<typeof navigationNodeSchema>;
export type NavigationLink = z.infer<typeof navigationLinkSchema>;
export type NavigationData = z.infer<typeof navigationDataSchema>;
export type MapDefinition = z.infer<typeof mapDefinitionSchema>;
