import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { GameID, GameInfo } from '../../core/Schemas';
import { GameMapType, GameMode } from '../../core/game/Game';
import { ApiPublicLobbiesResponseSchema } from '../../core/ExpressSchemas';
import { generateID } from '../../core/Util';
import { terrainMapFileLoader } from '../TerrainMapFileLoader';
import { translateText } from '../Utils';

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

interface PublicLobbyRef {
  stop: () => void;
  leaveLobby: () => void;
}

const PublicLobby = forwardRef<PublicLobbyRef, PublicLobbyProps>(({ onJoinLobby, onLeaveLobby }, ref) => {
  const [lobbies, setLobbies] = useState<GameInfo[]>([]);
  const [isLobbyHighlighted, setIsLobbyHighlighted] = useState(false);
  const [isButtonDebounced, setIsButtonDebounced] = useState(false);
  const [mapImages, setMapImages] = useState<Map<GameID, string>>(new Map());
  const [lobbyIDToStart] = useState<Map<GameID, number>>(new Map());
  const [currLobby, setCurrLobby] = useState<GameInfo | null>(null);

  const debounceDelay = 750;

  const loadMapImage = async (gameID: GameID, gameMap: string) => {
    try {
      const mapType = gameMap as GameMapType;
      const data = terrainMapFileLoader.getMapData(mapType);
      const imagePath = await data.webpPath();
      
      setMapImages(prev => new Map(prev).set(gameID, imagePath));
    } catch (error) {
      console.error('Failed to load map image:', error);
    }
  };

  const fetchAndUpdateLobbies = useCallback(async (): Promise<void> => {
    try {
      const newLobbies = await fetchLobbies();
      setLobbies(newLobbies);
      
      newLobbies.forEach((lobby) => {
        // Store the start time on first fetch because endpoint is cached
        if (!lobbyIDToStart.has(lobby.gameID)) {
          const msUntilStart = lobby.msUntilStart ?? 0;
          lobbyIDToStart.set(lobby.gameID, msUntilStart + Date.now());
        }

        // Load map image if not already loaded
        if (lobby.gameConfig && !mapImages.has(lobby.gameID)) {
          loadMapImage(lobby.gameID, lobby.gameConfig.gameMap);
        }
      });
    } catch (error) {
      console.error('Error fetching lobbies:', error);
    }
  }, [lobbyIDToStart, mapImages]);

  const fetchLobbies = async (): Promise<GameInfo[]> => {
    try {
      const response = await fetch('/api/public_lobbies');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      const data = ApiPublicLobbiesResponseSchema.parse(json);
      return data.lobbies;
    } catch (error) {
      console.error('Error fetching lobbies:', error);
      throw error;
    }
  };

  // Set up polling interval
  useEffect(() => {
    fetchAndUpdateLobbies();
    const interval = setInterval(() => fetchAndUpdateLobbies(), 1000);
    return () => clearInterval(interval);
  }, [fetchAndUpdateLobbies]);

  const stop = useCallback(() => {
    setIsLobbyHighlighted(false);
  }, []);

  const leaveLobby = useCallback(() => {
    setIsLobbyHighlighted(false);
    setCurrLobby(null);
  }, []);

  const lobbyClicked = (lobby: GameInfo) => {
    if (isButtonDebounced) {
      return;
    }

    // Set debounce state
    setIsButtonDebounced(true);
    setTimeout(() => {
      setIsButtonDebounced(false);
    }, debounceDelay);

    if (currLobby === null) {
      setIsLobbyHighlighted(true);
      setCurrLobby(lobby);
      onJoinLobby({
        gameID: lobby.gameID,
        clientID: generateID(),
      });
    } else {
      onLeaveLobby?.({ lobby: currLobby });
      leaveLobby();
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    stop,
    leaveLobby,
  }), [stop, leaveLobby]);

  // Return nothing if no lobbies (matches original Lit component)
  if (lobbies.length === 0) return null;

  const lobby = lobbies[0];
  if (!lobby?.gameConfig) {
    return null;
  }

  const start = lobbyIDToStart.get(lobby.gameID) ?? 0;
  const timeRemaining = Math.max(0, Math.floor((start - Date.now()) / 1000));

  // Format time to show minutes and seconds
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  const teamCount = lobby.gameConfig.gameMode === GameMode.Team
    ? (lobby.gameConfig.playerTeams ?? 0)
    : null;

  const mapImageSrc = mapImages.get(lobby.gameID);

  return (
    <button
      onClick={() => lobbyClicked(lobby)}
      disabled={isButtonDebounced}
      className={`isolate grid h-40 grid-cols-[100%] grid-rows-[100%] place-content-stretch w-full overflow-hidden ${
        isLobbyHighlighted
          ? 'bg-gradient-to-r from-green-600 to-green-500'
          : 'bg-gradient-to-r from-blue-600 to-blue-500'
      } text-white font-medium rounded-xl transition-opacity duration-200 hover:opacity-90 ${
        isButtonDebounced
          ? 'opacity-70 cursor-not-allowed'
          : ''
      }`}
    >
      {mapImageSrc ? (
        <img
          src={mapImageSrc}
          alt={lobby.gameConfig.gameMap}
          className="place-self-start col-span-full row-span-full h-full -z-10"
          style={{ maskImage: 'linear-gradient(to left, transparent, #fff)' }}
        />
      ) : (
        <div className="place-self-start col-span-full row-span-full h-full -z-10 bg-gray-300" />
      )}
      <div className="flex flex-col justify-between h-full col-span-full row-span-full p-4 md:p-6 text-right z-0">
        <div>
          <div className="text-lg md:text-2xl font-semibold">
            {translateText('public_lobby.join')}
          </div>
          <div className="text-md font-medium text-blue-100">
            <span
              className={`text-sm ${
                isLobbyHighlighted
                  ? 'text-green-600'
                  : 'text-blue-600'
              } bg-white rounded-sm px-1`}
            >
              {lobby.gameConfig.gameMode === GameMode.Team
                ? typeof teamCount === 'string'
                  ? translateText(`public_lobby.teams_${teamCount}`)
                  : translateText('public_lobby.teams', { num: teamCount ?? 0 })
                : translateText('game_mode.ffa')}
            </span>
            <span>
              {translateText(
                `map.${lobby.gameConfig.gameMap.toLowerCase().replace(/\s+/g, '')}`,
              )}
            </span>
          </div>
        </div>

        <div>
          <div className="text-md font-medium text-blue-100">
            {lobby.numClients} / {lobby.gameConfig.maxPlayers}
          </div>
          <div className="text-md font-medium text-blue-100">{timeDisplay}</div>
        </div>
      </div>
    </button>
  );
});

PublicLobby.displayName = 'PublicLobby';

export default PublicLobby;