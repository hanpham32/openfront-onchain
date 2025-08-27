import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiPublicLobbiesResponseSchema } from "../../core/ExpressSchemas";
import { GameID, GameInfo } from "../../core/Schemas";
import { generateID } from "../../core/Util";
import { GameMapType, GameMode } from "../../core/game/Game";
import { terrainMapFileLoader } from "../TerrainMapFileLoader";
import { translateText } from "../Utils";

export interface JoinLobbyEvent {
  clientID: string;
  gameID: string;
}
export interface LeaveLobbyEvent {
  lobby: GameInfo;
}
interface PublicLobbyProps {
  onJoinLobby: (event: JoinLobbyEvent) => void;
  onLeaveLobby?: (event: LeaveLobbyEvent) => void;
}
export interface PublicLobbyRef {
  stop: () => void;
  leaveLobby: () => void;
}

const POLL_MS = 2000;

const PublicLobby = forwardRef<PublicLobbyRef, PublicLobbyProps>(
  ({ onJoinLobby, onLeaveLobby }, ref) => {
    const [lobbies, setLobbies] = useState<GameInfo[]>([]);
    const [isLobbyHighlighted, setIsLobbyHighlighted] = useState(false);
    const [isButtonDebounced, setIsButtonDebounced] = useState(false);
    const [mapImages, setMapImages] = useState<Map<GameID, string>>(new Map());
    const [currLobby, setCurrLobby] = useState<GameInfo | null>(null);

    // store first-seen start timestamps (stable ref, avoid re-renders)
    const lobbyStartRef = useRef<Map<GameID, number>>(new Map());
    // avoid duplicate image loads
    const loadingImagesRef = useRef<Set<GameID>>(new Set());

    // polling guards
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inFlightRef = useRef(false);
    const isHiddenRef = useRef(document.hidden);

    const debounceDelay = 750;

    const fetchLobbies = useCallback(async (): Promise<GameInfo[]> => {
      const response = await fetch("/api/public_lobbies");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const data = ApiPublicLobbiesResponseSchema.parse(json);
      return data.lobbies;
    }, []);

    const fetchAndUpdateLobbies = useCallback(async () => {
      if (inFlightRef.current || isHiddenRef.current) return;
      inFlightRef.current = true;
      try {
        const newLobbies = await fetchLobbies();
        // only update state if changed (cheap shallow compare by ids + counts)
        const sameLength = lobbies.length === newLobbies.length;
        const sameList =
          sameLength &&
          lobbies.every((old, i) => {
            const n = newLobbies[i];
            return (
              old.gameID === n.gameID &&
              old.numClients === n.numClients &&
              old.msUntilStart === n.msUntilStart
            );
          });
        if (!sameList) setLobbies(newLobbies);

        // fill start times once (mutate ref only)
        for (const lobby of newLobbies) {
          if (!lobbyStartRef.current.has(lobby.gameID)) {
            const msUntilStart = lobby.msUntilStart ?? 0;
            lobbyStartRef.current.set(lobby.gameID, Date.now() + msUntilStart);
          }
        }
      } catch (err) {
        console.error("Error fetching lobbies:", err);
      } finally {
        inFlightRef.current = false;
      }
    }, [fetchLobbies, lobbies]);

    // Stable polling loop (no dependency on mapImages)
    useEffect(() => {
      // prime once
      fetchAndUpdateLobbies();

      intervalRef.current = setInterval(fetchAndUpdateLobbies, POLL_MS);
      const onVis = () => {
        isHiddenRef.current = document.hidden;
        if (document.hidden) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
        } else {
          // restart polling when tab becomes visible
          if (!intervalRef.current) {
            fetchAndUpdateLobbies(); // immediate refresh on resume
            intervalRef.current = setInterval(fetchAndUpdateLobbies, POLL_MS);
          }
        }
      };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        document.removeEventListener("visibilitychange", onVis);
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      };
    }, [fetchAndUpdateLobbies]);

    // Load images when lobbies list changes (decoupled from polling effect)
    useEffect(() => {
      for (const lobby of lobbies) {
        if (!lobby.gameConfig) continue;
        const id = lobby.gameID;
        if (mapImages.has(id) || loadingImagesRef.current.has(id)) continue;

        loadingImagesRef.current.add(id);
        (async () => {
          try {
            const mapType = lobby.gameConfig!.gameMap as GameMapType;
            const data = terrainMapFileLoader.getMapData(mapType);
            const imagePath = await data.webpPath();
            setMapImages((prev) => {
              const next = new Map(prev);
              next.set(id, imagePath);
              return next;
            });
          } catch (e) {
            console.error("Failed to load map image:", e);
          } finally {
            loadingImagesRef.current.delete(id);
          }
        })();
      }
    }, [lobbies, mapImages]);

    const stop = useCallback(() => {
      setIsLobbyHighlighted(false);
    }, []);

    const leaveLobby = useCallback(() => {
      setIsLobbyHighlighted(false);
      setCurrLobby(null);
    }, []);

    const lobbyClicked = (lobby: GameInfo) => {
      if (isButtonDebounced) return;

      setIsButtonDebounced(true);
      setTimeout(() => setIsButtonDebounced(false), debounceDelay);

      if (currLobby === null) {
        setIsLobbyHighlighted(true);
        setCurrLobby(lobby);
        onJoinLobby({ gameID: lobby.gameID, clientID: generateID() });
      } else {
        onLeaveLobby?.({ lobby: currLobby });
        leaveLobby();
      }
    };

    useImperativeHandle(ref, () => ({ stop, leaveLobby }), [stop, leaveLobby]);

    // Move memoized values before early returns to avoid hook order issues
    const lobby = lobbies[0];
    const teamCount =
      lobby?.gameConfig?.gameMode === GameMode.Team
        ? (lobby.gameConfig.playerTeams ?? 0)
        : null;

    // minor memo to avoid re-allocating translated literals
    const joinText = useMemo(() => translateText("Join"), []);
    const teamsText = useMemo(
      () => translateText("Teams", { num: teamCount ?? 0 }),
      [teamCount],
    );
    const ffaText = useMemo(() => translateText("game_mode.ffa"), []);
    const mapLabel = useMemo(
      () =>
        translateText(
          `map.${lobby?.gameConfig?.gameMap.toLowerCase().replace(/\s+/g, "") ?? ""}`,
        ),
      [lobby?.gameConfig?.gameMap],
    );

    // Early returns after all hooks
    if (lobbies.length === 0) return null;
    if (!lobby?.gameConfig) return null;

    const start = lobbyStartRef.current.get(lobby.gameID) ?? 0;
    const timeRemaining = Math.max(0, Math.floor((start - Date.now()) / 1000));
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timeDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    const mapImageSrc = mapImages.get(lobby.gameID);

    return (
      <button
        onClick={() => lobbyClicked(lobby)}
        disabled={isButtonDebounced}
        className={`isolate grid h-40 grid-cols-[100%] grid-rows-[100%] place-content-stretch w-full overflow-hidden ${
          isLobbyHighlighted
            ? "bg-gradient-to-r from-green-600 to-green-500"
            : "bg-gradient-to-r from-blue-600 to-blue-500"
        } text-white font-medium rounded-xl transition-opacity duration-200 hover:opacity-90 ${
          isButtonDebounced ? "opacity-70 cursor-not-allowed" : ""
        }`}
      >
        {mapImageSrc ? (
          <img
            src={mapImageSrc}
            alt={lobby.gameConfig.gameMap}
            className="place-self-start col-span-full row-span-full h-full -z-10"
            style={{ maskImage: "linear-gradient(to left, transparent, #fff)" }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="place-self-start col-span-full row-span-full h-full -z-10 bg-gray-300" />
        )}

        <div className="flex flex-col justify-between h-full col-span-full row-span-full p-4 md:p-6 text-right z-0">
          <div>
            <div className="text-lg md:text-2xl font-semibold">{joinText}</div>
            <div className="text-md font-medium text-blue-100">
              <span
                className={`text-sm ${
                  isLobbyHighlighted ? "text-green-600" : "text-blue-600"
                } bg-white rounded-sm px-1`}
              >
                {lobby.gameConfig.gameMode === GameMode.Team
                  ? teamsText
                  : ffaText}
              </span>
              <span>{mapLabel}</span>
            </div>
          </div>

          <div>
            <div className="text-md font-medium text-blue-100">
              {lobby.numClients} / {lobby.gameConfig.maxPlayers}
            </div>
            <div className="text-md font-medium text-blue-100">
              {timeDisplay}
            </div>
          </div>
        </div>
      </button>
    );
  },
);

PublicLobby.displayName = "PublicLobby";
export default PublicLobby;
