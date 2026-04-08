import type { MapDefinition } from "./maps";

export const thirdPersonSliceMap: MapDefinition = {
  mapId: "map_third-person-yard",
  name: "South Yard",
  bounds: {
    width: 36,
    height: 28,
  },
  collisionVolumes: [
    {
      volumeId: "volume_north-barricade",
      kind: "box",
      position: { x: 18, y: 5 },
      size: { width: 18, height: 2 },
    },
    {
      volumeId: "volume_central-truck",
      kind: "box",
      position: { x: 13, y: 13 },
      size: { width: 6, height: 3 },
    },
    {
      volumeId: "volume_east-shed",
      kind: "box",
      position: { x: 29, y: 19 },
      size: { width: 6, height: 6 },
    },
  ],
  zombieSpawnZones: [
    {
      zoneId: "zone_north-lane",
      center: { x: 28, y: 7 },
      radius: 3,
      maxAlive: 3,
      archetypeIds: ["zombie_shambler", "zombie_runner"],
    },
    {
      zoneId: "zone_south-lane",
      center: { x: 8, y: 23 },
      radius: 3,
      maxAlive: 2,
      archetypeIds: ["zombie_shambler"],
    },
  ],
  lootPoints: [
    {
      pointId: "point_loot-field-cache",
      position: { x: 18, y: 9 },
      tableId: "loot_police",
    },
  ],
  respawnPoints: [
    {
      pointId: "point_respawn-west-entry",
      position: { x: 4, y: 14 },
    },
    {
      pointId: "point_respawn-south-entry",
      position: { x: 12, y: 25 },
    },
    {
      pointId: "point_respawn-east-entry",
      position: { x: 32, y: 14 },
    },
    {
      pointId: "point_respawn-north-entry",
      position: { x: 20, y: 3 },
    },
    {
      pointId: "point_respawn-northwest-lane",
      position: { x: 4, y: 8 },
    },
    {
      pointId: "point_respawn-west-yard",
      position: { x: 5, y: 20 },
    },
    {
      pointId: "point_respawn-central-lane",
      position: { x: 9, y: 10 },
    },
    {
      pointId: "point_respawn-southwest-yard",
      position: { x: 15, y: 24 },
    },
    {
      pointId: "point_respawn-south-center",
      position: { x: 19, y: 20 },
    },
    {
      pointId: "point_respawn-southeast-yard",
      position: { x: 24, y: 24 },
    },
    {
      pointId: "point_respawn-east-lane",
      position: { x: 30, y: 9 },
    },
    {
      pointId: "point_respawn-far-east-yard",
      position: { x: 34, y: 24 },
    },
  ],
  interactablePlacements: [
    {
      placementId: "placement_field-cache",
      kind: "crate",
      position: { x: 18, y: 9 },
      interactionRadius: 1.5,
      prompt: "Search cache",
    },
  ],
  navigation: {
    nodes: [
      { nodeId: "node_west-entry", position: { x: 4, y: 14 } },
      { nodeId: "node_north-lane", position: { x: 12, y: 8 } },
      { nodeId: "node_center-west", position: { x: 12, y: 16 } },
      { nodeId: "node_center-east", position: { x: 24, y: 16 } },
      { nodeId: "node_east-lane", position: { x: 31, y: 14 } },
      { nodeId: "node_south-lane", position: { x: 10, y: 23 } },
    ],
    links: [
      { from: "node_west-entry", to: "node_north-lane", cost: 10 },
      { from: "node_north-lane", to: "node_west-entry", cost: 10 },
      { from: "node_west-entry", to: "node_center-west", cost: 8 },
      { from: "node_center-west", to: "node_west-entry", cost: 8 },
      { from: "node_center-west", to: "node_center-east", cost: 12 },
      { from: "node_center-east", to: "node_center-west", cost: 12 },
      { from: "node_center-east", to: "node_east-lane", cost: 7 },
      { from: "node_east-lane", to: "node_center-east", cost: 7 },
      { from: "node_center-west", to: "node_south-lane", cost: 8 },
      { from: "node_south-lane", to: "node_center-west", cost: 8 },
      { from: "node_north-lane", to: "node_center-east", cost: 14 },
      { from: "node_center-east", to: "node_north-lane", cost: 14 },
    ],
  },
};
