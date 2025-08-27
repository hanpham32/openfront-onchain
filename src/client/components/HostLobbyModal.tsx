import React, { useCallback, useEffect, useState } from "react";
import { FaStar } from "react-icons/fa";
import type { Abi } from "viem";
import { isHex, keccak256, pad, parseEther, toHex } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
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
import { getContractAddress, getOpenfrontABI } from "../contract/utils";
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
  // ---- UI state ----
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
  const [betAmountEth, setBetAmountEth] = useState("0.001");

  // ---- chain / wallet / tx ----
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

  const {
    writeContract: createLobby,
    data: createLobbyHash,
    error: createLobbyError,
    isPending,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: createLobbyHash });

  // ---- helpers ----
  const userSettings = new UserSettings();
  const CONTRACT_ADDRESS = getContractAddress("local");
  const ABI = getOpenfrontABI() as Abi;

  const toBytes32 = (id: string) =>
    isHex(id) ? pad(id as `0x${string}`, { size: 32 }) : keccak256(toHex(id));

  const txExplorer = (hash?: `0x${string}`) => {
    if (!hash) return undefined;
    // tweak per chain — example for hardhat/anvil has no explorer
    // add your preferred explorer here if using a public testnet/mainnet
    return undefined;
  };

  // ---- on-chain action with just-in-time nonce ----
  const handleCreateLobby = async () => {
    if (!isConnected || !address) return;

    const lobbyIdBytes32 = toBytes32(lobbyId);
    const betWei = parseEther(betAmountEth);

    // read nonce "pending" right before sending
    const pending = await client.getTransactionCount({
      address,
      blockTag: "pending",
    });
    // (optional) debug
    const latest = await client.getTransactionCount({
      address,
      blockTag: "latest",
    });
    console.log(
      "nonce latest:",
      Number(latest),
      "pending(next):",
      Number(pending),
    );

    createLobby({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: ABI,
      functionName: "createLobby",
      args: [lobbyIdBytes32, betWei],
      value: betWei, // payable
      nonce: Number(pending), // control the nonce
    });
  };

  // ---- server polling (unchanged) ----
  useEffect(() => {
    if (!isOpen || !lobbyId) return;
    const pollPlayers = async () => {
      const config = await getServerConfigFromClient();
      const url = `/${config.workerPath(lobbyId)}/api/game/${lobbyId}`;
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const gameInfo = GameInfoSchema.parse(data);
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
      // current fallback path
      const lobby = await createLobbyFallback(creatorClientID);
      setLobbyId(lobby.gameID);
      onJoinLobby({ gameID: lobby.gameID, clientID: creatorClientID });
    } catch (error) {
      console.error("Error creating lobby:", error);
    }
  }, [onJoinLobby, userSettings]);

  useEffect(() => {
    if (isOpen && !lobbyId) handleOpen();
  }, [isOpen, lobbyId, handleOpen]);

  const putGameConfig = async () => {
    const config = await getServerConfigFromClient();
    return fetch(
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
  };

  const handleMapSelection = (v: GameMapType) => {
    setSelectedMap(v);
    setUseRandomMap(false);
    void putGameConfig();
  };
  const handleRandomMapToggle = () => {
    setUseRandomMap(true);
    void putGameConfig();
  };
  const handleDifficultySelection = (v: Difficulty) => {
    setSelectedDifficulty(v);
    void putGameConfig();
  };
  const handleGameModeSelection = (v: GameMode) => {
    setGameMode(v);
    void putGameConfig();
  };
  const handleTeamCountSelection = (v: TeamCountConfig) => {
    setTeamCount(v);
    void putGameConfig();
  };
  const handleBotsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!Number.isFinite(value) || value < 0 || value > 400) return;
    setBots(value);
    setTimeout(() => void putGameConfig(), 300);
  };
  const toggleUnit = (unit: UnitType, checked: boolean) => {
    setDisabledUnits((prev) =>
      checked ? [...prev, unit] : prev.filter((u) => u !== unit),
    );
    void putGameConfig();
  };

  const startGame = async () => {
    await putGameConfig();
    onClose();
    const config = await getServerConfigFromClient();
    return fetch(
      `${window.location.origin}/${config.workerPath(lobbyId)}/api/start_game/${lobbyId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
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

  const kickPlayer = (clientID: string) => onKickPlayer({ target: clientID });
  const handleClose = () => {
    setCopySuccess(false);
    setClients([]);
    setLobbyId("");
    onClose();
  };

  // ---- UI ----
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      translationKey="Create a lobby"
    >
      <div className="space-y-6 w-full">
        {/* Lobby ID */}
        <div className="lobby-id-box">
          <button className="lobby-id-button flex items-center">
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
            <span className="lobby-id cursor-pointer" onClick={copyToClipboard}>
              {lobbyIdVisible ? lobbyId : "••••••••"}
            </span>
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

        {/* Bet */}
        <div className="options-section">
          <div className="option-title">Bet (ETH)</div>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={betAmountEth}
            onChange={(e) => setBetAmountEth(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
            placeholder="0.01"
          />
        </div>

        {/* Create button + tx status */}
        <div className="options-section">
          <button
            className="create-lobby-button-container"
            onClick={handleCreateLobby}
            disabled={!isConnected || isPending || isConfirming}
          >
            {isPending
              ? "Confirm in wallet…"
              : isConfirming
                ? "Submitting…"
                : "Create"}
          </button>

          {createLobbyHash && (
            <div className="mt-2 text-sm">
              <div>
                Tx: {createLobbyHash.slice(0, 10)}…{createLobbyHash.slice(-8)}
              </div>
              {isConfirming && <div>Waiting for confirmations…</div>}
              {isConfirmed && (
                <div className="text-green-400">
                  Lobby created ✅{" "}
                  {txExplorer(createLobbyHash) && (
                    <a
                      className="underline ml-2"
                      href={txExplorer(createLobbyHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on explorer
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {(createLobbyError ?? receiptError) && (
            <div className="mt-2 text-red-400 text-sm">
              {(createLobbyError ?? receiptError)?.message}
            </div>
          )}
        </div>

        {/* The rest of your UI: map, difficulty, mode, teams, options, players… */}
        {/* (left as-is; your handlers call putGameConfig() as before) */}

        {/* Map Selection */}
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

        {/* Difficulty */}
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
              .map((d) => (
                <option key={d} value={d as string}>
                  {d as string}
                </option>
              ))}
          </select>
        </div>

        {/* Mode */}
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

        {/* Team Count */}
        {gameMode !== GameMode.FFA && (
          <div className="options-section">
            <div className="option-title">{translateText("team_count")}</div>
            <div className="option-cards">
              {[2, 3, 4, 5, 6, 7, Quads, Trios, Duos].map((option) => (
                <div
                  key={option as any}
                  className={`option-card ${teamCount === option ? "selected" : ""}`}
                  onClick={() => handleTeamCountSelection(option)}
                >
                  <div className="option-card-title">
                    {typeof option === "string"
                      ? translateText(`public_lobby.teams_${option}`)
                      : translateText("public_lobby.teams", {
                          num: option as number,
                        })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Options (unchanged)… */}

        {/* Players */}
        <div className="options-section">
          <div className="option-title">
            {clients.length}{" "}
            {clients.length === 1
              ? translateText("player")
              : translateText("players")}
          </div>
          <div className="players-list">
            {clients.map((c) => (
              <span key={c.clientID} className="player-tag">
                {c.username}
                {c.clientID === lobbyCreatorClientID ? (
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
                    onClick={() => kickPlayer(c.clientID)}
                    title={`Remove ${c.username}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex justify-center w-full mt-5">
            <button
              onClick={startGame}
              disabled={clients.length < 2}
              className="w-full max-w-[300px] px-5 py-4 text-base cursor-pointer bg-blue-600 text-white border-none rounded-lg transition-colors duration-300 inline-block mb-5 hover:bg-blue-700 disabled:bg-gradient-to-r disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {clients.length === 1
                ? translateText("Waiting")
                : translateText("Start")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ----- fallback server creation (unchanged) -----
async function createLobbyFallback(creatorClientID: string): Promise<GameInfo> {
  const config = await getServerConfigFromClient();
  const id = generateID();
  const res = await fetch(
    `/${config.workerPath(id)}/api/create_game/${id}?creatorClientID=${encodeURIComponent(creatorClientID)}`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
  );
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const data = await res.json();
  return data as GameInfo;
}

export default HostLobbyModal;
