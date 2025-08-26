import { Config, GameEnv, ServerConfig } from "./Config";
import { DevConfig, DevServerConfig } from "./DevConfig";
import { ApiEnvResponseSchema } from "../ExpressSchemas";
import { DefaultConfig } from "./DefaultConfig";
import { GameConfig } from "../Schemas";
import { UserSettings } from "../game/UserSettings";
import { preprodConfig } from "./PreprodConfig";
import { prodConfig } from "./ProdConfig";

export let cachedSC: ServerConfig | null = null;

export async function getConfig(
  gameConfig: GameConfig,
  userSettings: UserSettings | null,
  isReplay = false,
): Promise<Config> {
  const sc = await getServerConfigFromClient();
  switch (sc.env()) {
    case GameEnv.Dev:
      return new DevConfig(sc, gameConfig, userSettings, isReplay);
    case GameEnv.Preprod:
    case GameEnv.Prod:
      console.log("using prod config");
      return new DefaultConfig(sc, gameConfig, userSettings, isReplay);
    default:
      throw Error(`unsupported server configuration: ${process.env.GAME_ENV}`);
  }
}
export async function getServerConfigFromClient(): Promise<ServerConfig> {
  if (cachedSC) {
    return cachedSC;
  }
  const response = await fetch("/api/env");

  if (!response.ok) {
    throw new Error(
      `Failed to fetch server config: ${response.status} ${response.statusText}`,
    );
  }
  const json = await response.json();
  const config = ApiEnvResponseSchema.parse(json);
  // Log the retrieved configuration
  console.log("Server config loaded:", config);

  cachedSC = getServerConfig(config.game_env);
  return cachedSC;
}
export function getServerConfigFromServer(): ServerConfig {
  const gameEnv = process.env.GAME_ENV ?? "dev";
  return getServerConfig(gameEnv);
}
export function getServerConfig(gameEnv: string) {
  switch (gameEnv) {
    case "dev":
      console.log("using dev server config");
      return new DevServerConfig();
    case "staging":
      console.log("using preprod server config");
      return preprodConfig;
    case "prod":
      console.log("using prod server config");
      return prodConfig;
    default:
      throw Error(`unsupported server configuration: ${gameEnv}`);
  }
}
