// This file contians schemas for the primary openfront express server
import { GameInfoSchema } from "./Schemas";
import { z } from "zod";

export const ApiEnvResponseSchema = z.object({
  game_env: z.string(),
});
export type ApiEnvResponse = z.infer<typeof ApiEnvResponseSchema>;

export const ApiPublicLobbiesResponseSchema = z.object({
  lobbies: GameInfoSchema.array(),
});
export type ApiPublicLobbiesResponse = z.infer<
  typeof ApiPublicLobbiesResponseSchema
>;
