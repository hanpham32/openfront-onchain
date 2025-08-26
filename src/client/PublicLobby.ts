import { GameID, GameInfo } from "../core/Schemas";
import { GameMapType, GameMode } from "../core/game/Game";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ApiPublicLobbiesResponseSchema } from "../core/ExpressSchemas";
import { JoinLobbyEvent } from "./Main";
import { generateID } from "../core/Util";
import { terrainMapFileLoader } from "./TerrainMapFileLoader";
import { translateText } from "../client/Utils";

@customElement("public-lobby")
export class PublicLobby extends LitElement {
  @state() private lobbies: GameInfo[] = [];
  @state() public isLobbyHighlighted = false;
  @state() private isButtonDebounced = false;
  @state() private readonly mapImages: Map<GameID, string> = new Map();
  private lobbiesInterval: number | null = null;
  private currLobby: GameInfo | null = null;
  private readonly debounceDelay = 750;
  private readonly lobbyIDToStart = new Map<GameID, number>();

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.fetchAndUpdateLobbies();
    this.lobbiesInterval = window.setInterval(
      () => this.fetchAndUpdateLobbies(),
      1000,
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.lobbiesInterval !== null) {
      clearInterval(this.lobbiesInterval);
      this.lobbiesInterval = null;
    }
  }

  private async fetchAndUpdateLobbies(): Promise<void> {
    try {
      this.lobbies = await this.fetchLobbies();
      this.lobbies.forEach((l) => {
        // Store the start time on first fetch because endpoint is cached, causing
        // the time to appear irregular.
        if (!this.lobbyIDToStart.has(l.gameID)) {
          const msUntilStart = l.msUntilStart ?? 0;
          this.lobbyIDToStart.set(l.gameID, msUntilStart + Date.now());
        }

        // Load map image if not already loaded
        if (l.gameConfig && !this.mapImages.has(l.gameID)) {
          this.loadMapImage(l.gameID, l.gameConfig.gameMap);
        }
      });
    } catch (error) {
      console.error("Error fetching lobbies:", error);
    }
  }

  private async loadMapImage(gameID: GameID, gameMap: string) {
    try {
      // Convert string to GameMapType enum value
      const mapType = gameMap as GameMapType;
      const data = terrainMapFileLoader.getMapData(mapType);
      this.mapImages.set(gameID, await data.webpPath());
      this.requestUpdate();
    } catch (error) {
      console.error("Failed to load map image:", error);
    }
  }

  async fetchLobbies(): Promise<GameInfo[]> {
    try {
      const response = await fetch("/api/public_lobbies");
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const json = await response.json();
      const data = ApiPublicLobbiesResponseSchema.parse(json);
      return data.lobbies;
    } catch (error) {
      console.error("Error fetching lobbies:", error);
      throw error;
    }
  }

  public stop() {
    if (this.lobbiesInterval !== null) {
      this.isLobbyHighlighted = false;
      clearInterval(this.lobbiesInterval);
      this.lobbiesInterval = null;
    }
  }

  render() {
    if (this.lobbies.length === 0) return html``;

    const lobby = this.lobbies[0];
    if (!lobby?.gameConfig) {
      return;
    }
    const start = this.lobbyIDToStart.get(lobby.gameID) ?? 0;
    const timeRemaining = Math.max(0, Math.floor((start - Date.now()) / 1000));

    // Format time to show minutes and seconds
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timeDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    const teamCount =
      lobby.gameConfig.gameMode === GameMode.Team
        ? (lobby.gameConfig.playerTeams ?? 0)
        : null;

    const mapImageSrc = this.mapImages.get(lobby.gameID);

    return html`
      <button
        @click=${() => this.lobbyClicked(lobby)}
        ?disabled=${this.isButtonDebounced}
        class="isolate grid h-40 grid-cols-[100%] grid-rows-[100%] place-content-stretch w-full overflow-hidden ${
          this.isLobbyHighlighted
            ? "bg-gradient-to-r from-green-600 to-green-500"
            : "bg-gradient-to-r from-blue-600 to-blue-500"
        } text-white font-medium rounded-xl transition-opacity duration-200 hover:opacity-90 ${
          this.isButtonDebounced
            ? "opacity-70 cursor-not-allowed"
            : ""}"
      >
        ${mapImageSrc
          ? html`<img
              src="${mapImageSrc}"
              alt="${lobby.gameConfig.gameMap}"
              class="place-self-start col-span-full row-span-full h-full -z-10"
              style="mask-image: linear-gradient(to left, transparent, #fff)"
            />`
          : html`<div
              class="place-self-start col-span-full row-span-full h-full -z-10 bg-gray-300"
            ></div>`}
        <div
          class="flex flex-col justify-between h-full col-span-full row-span-full p-4 md:p-6 text-right z-0"
        >
          <div>
            <div class="text-lg md:text-2xl font-semibold">
              ${translateText("public_lobby.join")}
            </div>
            <div class="text-md font-medium text-blue-100">
              <span
                class="text-sm ${this.isLobbyHighlighted
                  ? "text-green-600"
                  : "text-blue-600"} bg-white rounded-sm px-1"
              >
                ${lobby.gameConfig.gameMode === GameMode.Team
                  ? typeof teamCount === "string"
                    ? translateText(`public_lobby.teams_${teamCount}`)
                    : translateText("public_lobby.teams", {
                      num: teamCount ?? 0,
                    })
                  : translateText("game_mode.ffa")}</span
              >
              <span
                >${translateText(
                  `map.${lobby.gameConfig.gameMap.toLowerCase().replace(/\s+/g, "")}`,
                )}</span
              >
            </div>
          </div>

          <div>
            <div class="text-md font-medium text-blue-100">
              ${lobby.numClients} / ${lobby.gameConfig.maxPlayers}
            </div>
            <div class="text-md font-medium text-blue-100">${timeDisplay}</div>
          </div>
        </div>
      </button>
    `;
  }

  leaveLobby() {
    this.isLobbyHighlighted = false;
    this.currLobby = null;
  }

  private lobbyClicked(lobby: GameInfo) {
    if (this.isButtonDebounced) {
      return;
    }

    // Set debounce state
    this.isButtonDebounced = true;

    // Reset debounce after delay
    setTimeout(() => {
      this.isButtonDebounced = false;
    }, this.debounceDelay);

    if (this.currLobby === null) {
      this.isLobbyHighlighted = true;
      this.currLobby = lobby;
      this.dispatchEvent(
        new CustomEvent("join-lobby", {
          detail: {
            gameID: lobby.gameID,
            clientID: generateID(),
          } as JoinLobbyEvent,
          bubbles: true,
          composed: true,
        }),
      );
    } else {
      this.dispatchEvent(
        new CustomEvent("leave-lobby", {
          detail: { lobby: this.currLobby },
          bubbles: true,
          composed: true,
        }),
      );
      this.leaveLobby();
    }
  }
}
