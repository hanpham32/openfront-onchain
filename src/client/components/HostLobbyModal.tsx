import React, { useCallback, useEffect, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import {
  ClientInfo,
  GameConfig,
  GameInfo,
  GameInfoSchema,
  TeamCountConfig,
} from "../../core/Schemas";
import { generateID } from "../../core/Util";
import { getServerConfigFromClient } from "../../core/configuration/ConfigLoader";
import {
  Difficulty,
  Duos,
  GameMapType,
  GameMode,
  Quads,
  Trios,
  UnitType,
} from "../../core/game/Game";
import { UserSettings } from "../../core/game/UserSettings";
import { translateText } from "../Utils";
// import { renderUnitTypeOptions } from '../utilities/RenderUnitTypeOptions';
// import randomMap from '../../../resources/images/RandomMap.webp';
import { FaStar } from "react-icons/fa";
import Modal from "./Modal";

export interface JoinLobbyEvent {
  clientID: string;
  gameID: string;
}

export interface KickPlayerEvent {
  target: string;
}

interface HostLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinLobby: (event: JoinLobbyEvent) => void;
  onKickPlayer: (event: KickPlayerEvent) => void;
}

export const HostLobbyModal: React.FC<HostLobbyModalProps> = ({
  isOpen,
  onClose,
  onJoinLobby,
  onKickPlayer,
}) => {
  const [selectedMap, setSelectedMap] = useState<GameMapType>(
    GameMapType.World,
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(
    Difficulty.Medium,
  );
  const [disableNPCs, setDisableNPCs] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.FFA);
  const [teamCount, setTeamCount] = useState<TeamCountConfig>(2);
  const [bots, setBots] = useState(400);
  const [infiniteGold, setInfiniteGold] = useState(false);
  const [donateGold, setDonateGold] = useState(false);
  const [infiniteTroops, setInfiniteTroops] = useState(false);
  const [donateTroops, setDonateTroops] = useState(false);
  const [instantBuild, setInstantBuild] = useState(false);
  const [lobbyId, setLobbyId] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [useRandomMap, setUseRandomMap] = useState(false);
  const [disabledUnits, setDisabledUnits] = useState<UnitType[]>([]);
  const [lobbyCreatorClientID, setLobbyCreatorClientID] = useState("");
  const [lobbyIdVisible, setLobbyIdVisible] = useState(true);

  const { address, isConnected } = useAccount();

  const {
    writeContract: createLobby,
    data: createLobbyHash,
    error: createLobbyError,
  } = useWriteContract();

  const userSettings = new UserSettings();

  // Polling for players
  useEffect(() => {
    if (!isOpen || !lobbyId) return;

    const pollPlayers = async () => {
      const config = await getServerConfigFromClient();
      const url = `/${config.workerPath(lobbyId)}/api/game/${lobbyId}`;
      console.log(`Polling players for lobby ${lobbyId} at URL: ${url}`);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        console.log(`Poll response status: ${response.status}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const gameInfo = GameInfoSchema.parse(data);
        console.log(`got game info response: ${JSON.stringify(gameInfo)}`);
        console.log(`Number of clients: ${gameInfo.clients?.length || 0}`);

        setClients(gameInfo.clients ?? []);
      } catch (error) {
        console.error("Error polling players:", error);
      }
    };

    const interval = setInterval(pollPlayers, 1000);
    return () => clearInterval(interval);
  }, [isOpen, lobbyId]);

  const handleOpen = useCallback(async () => {
    const creatorClientID = generateID();
    setLobbyCreatorClientID(creatorClientID);
    setLobbyIdVisible(userSettings.get("settings.lobbyIdVisibility", true));

    try {
      // For now, fallback to the original server-based lobby creation
      // TODO: Replace with smart contract createLobby call when implemented
      const lobby = await createLobbyFallback(creatorClientID);
      setLobbyId(lobby.gameID);

      onJoinLobby({
        gameID: lobby.gameID,
        clientID: creatorClientID,
      });
    } catch (error) {
      console.error("Error creating lobby:", error);
    }
  }, [onJoinLobby, userSettings]);

  useEffect(() => {
    if (isOpen && !lobbyId) {
      handleOpen();
    }
  }, [isOpen, lobbyId, handleOpen]);

  const putGameConfig = async () => {
    const config = await getServerConfigFromClient();
    const response = await fetch(
      `${window.location.origin}/${config.workerPath(lobbyId)}/api/game/${lobbyId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameMap: selectedMap,
          difficulty: selectedDifficulty,
          disableNPCs,
          bots,
          infiniteGold,
          donateGold,
          infiniteTroops,
          donateTroops,
          instantBuild,
          gameMode,
          disabledUnits,
          playerTeams: teamCount,
        } satisfies Partial<GameConfig>),
      },
    );
    return response;
  };

  const handleMapSelection = (mapValue: GameMapType) => {
    setSelectedMap(mapValue);
    setUseRandomMap(false);
    putGameConfig();
  };

  const handleRandomMapToggle = () => {
    setUseRandomMap(true);
    putGameConfig();
  };

  const handleDifficultySelection = (value: Difficulty) => {
    setSelectedDifficulty(value);
    putGameConfig();
  };

  const handleGameModeSelection = (value: GameMode) => {
    setGameMode(value);
    putGameConfig();
  };

  const handleTeamCountSelection = (value: TeamCountConfig) => {
    setTeamCount(value);
    putGameConfig();
  };

  const handleBotsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (isNaN(value) || value < 0 || value > 400) return;

    setBots(value);
    // Debounce the config update
    setTimeout(() => putGameConfig(), 300);
  };

  const toggleUnit = (unit: UnitType, checked: boolean) => {
    console.log(`Toggling unit type: ${unit} to ${checked}`);
    setDisabledUnits((prev) =>
      checked ? [...prev, unit] : prev.filter((u) => u !== unit),
    );
    putGameConfig();
  };

  const startGame = async () => {
    await putGameConfig();
    console.log(`Starting private game with map: ${selectedMap}`);

    onClose();
    const config = await getServerConfigFromClient();
    const response = await fetch(
      `${window.location.origin}/${config.workerPath(lobbyId)}/api/start_game/${lobbyId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    return response;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(lobbyId);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error(`Failed to copy text: ${err}`);
    }
  };

  const kickPlayer = (clientID: string) => {
    onKickPlayer({ target: clientID });
  };

  const handleClose = () => {
    setCopySuccess(false);
    setClients([]);
    setLobbyId("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      translationKey="Create a lobby"
    >
      <div className="space-y-6">
        {/* Lobby ID Section */}
        <div className="lobby-id-box">
          <button className="lobby-id-button flex items-center">
            {/* Visibility toggle icon */}
            <svg
              className="visibility-icon cursor-pointer mr-2"
              onClick={() => setLobbyIdVisible(!lobbyIdVisible)}
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 512 512"
              height="18px"
              width="18px"
              xmlns="http://www.w3.org/2000/svg"
            >
              {lobbyIdVisible ? (
                <path d="M256 105c-101.8 0-188.4 62.7-224 151 35.6 88.3 122.2 151 224 151s188.4-62.7 224-151c-35.6-88.3-122.2-151-224-151zm0 251.7c-56 0-101.7-45.7-101.7-101.7S200 153.3 256 153.3 357.7 199 357.7 255 312 356.7 256 356.7zm0-161.1c-33 0-59.4 26.4-59.4 59.4s26.4 59.4 59.4 59.4 59.4-26.4 59.4-59.4-26.4-59.4-59.4-59.4z" />
              ) : (
                <path
                  d="M448 256s-64-128-192-128S64 256 64 256c32 64 96 128 192 128s160-64 192-128z M144 256l224 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="32"
                  strokeLinecap="round"
                />
              )}
            </svg>

            {/* Lobby ID */}
            <span className="lobby-id cursor-pointer" onClick={copyToClipboard}>
              {lobbyIdVisible ? lobbyId : "••••••••"}
            </span>

            {/* Copy icon/success indicator */}
            <div onClick={copyToClipboard} className="ml-2 cursor-pointer">
              {copySuccess ? (
                <span className="copy-success-icon">✓</span>
              ) : (
                <svg
                  className="clipboard-icon"
                  stroke="currentColor"
                  fill="currentColor"
                  strokeWidth="0"
                  viewBox="0 0 512 512"
                  height="18px"
                  width="18px"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M296 48H176.5C154.4 48 136 65.4 136 87.5V96h-7.5C106.4 96 88 113.4 88 135.5v288c0 22.1 18.4 40.5 40.5 40.5h208c22.1 0 39.5-18.4 39.5-40.5V416h8.5c22.1 0 39.5-18.4 39.5-40.5V176L296 48zm0 44.6l83.4 83.4H296V92.6zm48 330.9c0 4.7-3.4 8.5-7.5 8.5h-208c-4.4 0-8.5-4.1-8.5-8.5v-288c0-4.1 3.8-7.5 8.5-7.5h7.5v255.5c0 22.1 10.4 32.5 32.5 32.5H344v7.5zm48-48c0 4.7-3.4 8.5-7.5 8.5h-208c-4.4 0-8.5-4.1-8.5-8.5v-288c0-4.1 3.8-7.5 8.5-7.5H264v128h128v167.5z" />
                </svg>
              )}
            </div>
          </button>
        </div>

        {/* Map Selection - Simplified */}
        <div className="options-section">
          <div className="option-title">Map: {selectedMap}</div>
          <select
            value={selectedMap}
            onChange={(e) => handleMapSelection(e.target.value as GameMapType)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
          >
            {Object.values(GameMapType).map((map) => (
              <option key={map} value={map}>
                {map}
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty Selection */}
        <div className="options-section">
          <div className="option-title">Difficulty: {selectedDifficulty}</div>
          <select
            value={selectedDifficulty}
            onChange={(e) =>
              handleDifficultySelection(e.target.value as Difficulty)
            }
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
          >
            {Object.values(Difficulty)
              .filter((d) => typeof d === "string")
              .map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty}
                </option>
              ))}
          </select>
        </div>

        {/* Game Mode Selection */}
        <div className="options-section">
          <div className="option-title">{translateText("mode")}</div>
          <div className="option-cards">
            <div
              className={`option-card ${gameMode === GameMode.FFA ? "selected" : ""}`}
              onClick={() => handleGameModeSelection(GameMode.FFA)}
            >
              <div className="option-card-title">{translateText("ffa")}</div>
            </div>
            <div
              className={`option-card ${gameMode === GameMode.Team ? "selected" : ""}`}
              onClick={() => handleGameModeSelection(GameMode.Team)}
            >
              <div className="option-card-title">{translateText("teams")}</div>
            </div>
          </div>
        </div>

        {/* Team Count Selection (only for team mode) */}
        {gameMode !== GameMode.FFA && (
          <div className="options-section">
            <div className="option-title">{translateText("team_count")}</div>
            <div className="option-cards">
              {[2, 3, 4, 5, 6, 7, Quads, Trios, Duos].map((option) => (
                <div
                  key={option}
                  className={`option-card ${teamCount === option ? "selected" : ""}`}
                  onClick={() => handleTeamCountSelection(option)}
                >
                  <div className="option-card-title">
                    {typeof option === "string"
                      ? translateText(`public_lobby.teams_${option}`)
                      : translateText("public_lobby.teams", { num: option })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game Options */}
        <div className="options-section">
          <div className="option-title">{translateText("options_title")}</div>
          <div className="option-cards">
            <label htmlFor="bots-count" className="option-card">
              <input
                type="range"
                id="bots-count"
                min="0"
                max="400"
                step="1"
                value={bots}
                onChange={handleBotsChange}
              />
              <div className="option-card-title">
                <span>{translateText("bots")}</span>
                {bots === 0 ? translateText("bots_disabled") : bots}
              </div>
            </label>

            <label
              htmlFor="disable-npcs"
              className={`option-card ${disableNPCs ? "selected" : ""}`}
            >
              <div className="checkbox-icon"></div>
              <input
                type="checkbox"
                id="disable-npcs"
                checked={disableNPCs}
                onChange={(e) => {
                  setDisableNPCs(e.target.checked);
                  putGameConfig();
                }}
              />
              <div className="option-card-title">
                {translateText("disable_nations")}
              </div>
            </label>

            <label
              htmlFor="instant-build"
              className={`option-card ${instantBuild ? "selected" : ""}`}
            >
              <div className="checkbox-icon"></div>
              <input
                type="checkbox"
                id="instant-build"
                checked={instantBuild}
                onChange={(e) => {
                  setInstantBuild(e.target.checked);
                  putGameConfig();
                }}
              />
              <div className="option-card-title">
                {translateText("instant_build")}
              </div>
            </label>

            <label
              htmlFor="donate-gold"
              className={`option-card ${donateGold ? "selected" : ""}`}
            >
              <div className="checkbox-icon"></div>
              <input
                type="checkbox"
                id="donate-gold"
                checked={donateGold}
                onChange={(e) => {
                  setDonateGold(e.target.checked);
                  putGameConfig();
                }}
              />
              <div className="option-card-title">
                {translateText("donate_gold")}
              </div>
            </label>

            <label
              htmlFor="donate-troops"
              className={`option-card ${donateTroops ? "selected" : ""}`}
            >
              <div className="checkbox-icon"></div>
              <input
                type="checkbox"
                id="donate-troops"
                checked={donateTroops}
                onChange={(e) => {
                  setDonateTroops(e.target.checked);
                  putGameConfig();
                }}
              />
              <div className="option-card-title">
                {translateText("donate_troops")}
              </div>
            </label>

            <label
              htmlFor="infinite-gold"
              className={`option-card ${infiniteGold ? "selected" : ""}`}
            >
              <div className="checkbox-icon"></div>
              <input
                type="checkbox"
                id="infinite-gold"
                checked={infiniteGold}
                onChange={(e) => {
                  setInfiniteGold(e.target.checked);
                  putGameConfig();
                }}
              />
              <div className="option-card-title">
                {translateText("infinite_gold")}
              </div>
            </label>

            <label
              htmlFor="infinite-troops"
              className={`option-card ${infiniteTroops ? "selected" : ""}`}
            >
              <div className="checkbox-icon"></div>
              <input
                type="checkbox"
                id="infinite-troops"
                checked={infiniteTroops}
                onChange={(e) => {
                  setInfiniteTroops(e.target.checked);
                  putGameConfig();
                }}
              />
              <div className="option-card-title">
                {translateText("infinite_troops")}
              </div>
            </label>

            {/* Unit type options temporarily disabled - need to convert renderUnitTypeOptions */}
            {/* 
            <hr style={{ width: '100%', borderTop: '1px solid #444', margin: '16px 0' }} />
            <div style={{ margin: '8px 0 12px 0', fontWeight: 'bold', color: '#ccc', textAlign: 'center' }}>
              {translateText('enables_title')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' }}>
              {renderUnitTypeOptions({
                disabledUnits: disabledUnits,
                toggleUnit: toggleUnit,
              })}
            </div>
            */}
          </div>
        </div>

        {/* Players Section */}
        <div className="options-section">
          <div className="option-title">
            {clients.length}
            {clients.length === 1
              ? translateText("player")
              : translateText("players")}
          </div>

          <div className="players-list">
            {clients.map((client) => (
              <span key={client.clientID} className="player-tag">
                {client.username}
                {client.clientID === lobbyCreatorClientID ? (
                  <span className="host-badge">
                    <FaStar
                      className="host-icon"
                      size={16}
                      style={{ marginLeft: "8px", color: "#ffd700" }}
                    />
                  </span>
                ) : (
                  <button
                    className="remove-player-btn"
                    onClick={() => kickPlayer(client.clientID)}
                    title={`Remove ${client.username}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>

          <div className="start-game-button-container">
            <button
              onClick={startGame}
              disabled={clients.length < 2}
              className="start-game-button"
            >
              {clients.length === 1
                ? translateText("waiting")
                : translateText("start")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

async function createLobbyFallback(creatorClientID: string): Promise<GameInfo> {
  const config = await getServerConfigFromClient();
  try {
    const id = generateID();
    const response = await fetch(
      `/${config.workerPath(id)}/api/create_game/${id}?creatorClientID=${encodeURIComponent(creatorClientID)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Server error response:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Success:", data);

    return data as GameInfo;
  } catch (error) {
    console.error("Error creating lobby:", error);
    throw error;
  }
}

export default HostLobbyModal;
