import { z } from "zod";

const idPattern = /^[a-z]+[a-z0-9-]*_[a-z0-9-]+$/;

export const entityIdSchema = z.string().regex(idPattern, "invalid entity id");
export const roomIdSchema = z.string().regex(/^room_[a-z0-9-]+$/, "invalid room id");
export const sessionTokenSchema = z
  .string()
  .min(1)
  .regex(/^session_[a-z0-9-]+$/, "invalid session token");
export const itemIdSchema = z.string().min(1);
export const weaponIdSchema = z.string().min(1);
export const zombieArchetypeIdSchema = z.string().min(1);
export const lootTableIdSchema = z.string().min(1);
export const mapIdSchema = z.string().min(1);

export type EntityId = z.infer<typeof entityIdSchema>;
export type RoomId = z.infer<typeof roomIdSchema>;
export type SessionToken = z.infer<typeof sessionTokenSchema>;
export type ItemId = z.infer<typeof itemIdSchema>;
export type WeaponId = z.infer<typeof weaponIdSchema>;
export type ZombieArchetypeId = z.infer<typeof zombieArchetypeIdSchema>;
export type LootTableId = z.infer<typeof lootTableIdSchema>;
export type MapId = z.infer<typeof mapIdSchema>;
