import { mapDefinitionSchema, type MapDefinition } from "@2dayz/shared";

import { defaultTownMap } from "../content/defaultTownMap";

export const loadMapDefinition = (): MapDefinition => {
  return mapDefinitionSchema.parse(defaultTownMap);
};
