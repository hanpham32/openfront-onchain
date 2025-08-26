import React, { useState, useEffect } from 'react';

import { GameInfo } from '../../core/Schemas';
import { JoinLobbyEvent } from '../App';

import Button from './Button';

interface PublicLobbyProps {
  onJoinLobby: (event: JoinLobbyEvent) => void;
}

const PublicLobby: React.FC<PublicLobbyProps> = ({ onJoinLobby }) => {
  const [lobbies, setLobbies] = useState<GameInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLobby, setSelectedLobby] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicLobbies();
    const interval = setInterval(fetchPublicLobbies, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchPublicLobbies = async () => {
    try {
      const response = await fetch('/api/public_lobbies');
      if (response.ok) {
        const data = await response.json() as { lobbies?: GameInfo[] };
        setLobbies(data.lobbies ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch public lobbies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinLobby = (gameID: string) => {
    onJoinLobby({
      clientID: generateClientId(),
      gameID: gameID,
    });
  };

  const generateClientId = (): string => {
    return Math.random().toString(36).substr(2, 8);
  };

  const stop = () => {
    // Stop any ongoing operations
  };

  const leaveLobby = () => {
    setSelectedLobby(null);
  };

  if (isLoading) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 mb-4">
        <div className="text-center">Loading public lobbies...</div>
      </div>
    );
  }

  if (lobbies.length === 0) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold mb-3 text-center">Public Lobbies</h3>
        <div className="text-center text-gray-600 dark:text-gray-400">
          No public lobbies available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 text-center">Public Lobbies</h3>
      <div className="space-y-2">
        {lobbies.map((lobby) => (
          <div
            key={lobby.gameID}
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              selectedLobby === lobby.gameID
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <div className="flex-1">
              <div className="font-medium">{lobby.gameID}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {lobby.gameConfig?.gameMode ?? 'Unknown'} • {lobby.numClients ?? 0}/{lobby.gameConfig?.maxPlayers ?? 'N/A'} players
              </div>
            </div>
            <Button
              title="Join"
              onClick={() => handleJoinLobby(lobby.gameID)}
              secondary
              disabled={(lobby.numClients ?? 0) >= (lobby.gameConfig?.maxPlayers ?? 0)}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 text-center">
        <Button
          title="Refresh"
          onClick={fetchPublicLobbies}
          secondary
        />
      </div>
    </div>
  );
};

export default PublicLobby;