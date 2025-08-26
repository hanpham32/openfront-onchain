import React, { useEffect, useRef, useState } from "react";
import { getServerConfigFromClient } from "../../core/configuration/ConfigLoader";
import { GameInfoSchema } from "../../core/Schemas";
import { generateID } from "../../core/Util";
import {
  WorkerApiArchivedGameLobbySchema,
  WorkerApiGameIdExistsSchema,
} from "../../core/WorkerSchemas";
import { translateText } from "../Utils";
import Button from "./Button";
import Modal from "./Modal";

export interface JoinLobbyEvent {
  clientID: string;
  gameID: string;
  gameStartInfo?: any;
  gameRecord?: any;
}

interface JoinPrivateLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinLobby: (event: JoinLobbyEvent) => void;
  lobbyId?: string;
}

export const JoinPrivateLobbyModal: React.FC<JoinPrivateLobbyModalProps> = ({
  isOpen,
  onClose,
  onJoinLobby,
  lobbyId: initialLobbyId = "",
}) => {
  const [lobbyId, setLobbyId] = useState("");
  const [message, setMessage] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [players, setPlayers] = useState<string[]>([]);
  const lobbyIdInputRef = useRef<HTMLInputElement>(null);
  const playersIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && initialLobbyId) {
      setLobbyId(extractLobbyIdFromUrl(initialLobbyId));
      joinLobby(extractLobbyIdFromUrl(initialLobbyId));
    }
  }, [isOpen, initialLobbyId]);

  useEffect(() => {
    return () => {
      if (playersIntervalRef.current) {
        clearInterval(playersIntervalRef.current);
        playersIntervalRef.current = null;
      }
    };
  }, []);

  const extractLobbyIdFromUrl = (input: string): string => {
    if (input.startsWith("http")) {
      if (input.includes("#join=")) {
        const params = new URLSearchParams(input.split("#")[1]);
        return params.get("join") ?? input;
      } else if (input.includes("join/")) {
        return input.split("join/")[1];
      } else {
        return input;
      }
    } else {
      return input;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setLobbyId(extractLobbyIdFromUrl(value));
  };

  const pasteFromClipboard = async () => {
    try {
      // Check if we're on a secure context (HTTPS or localhost)
      const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      // Try modern clipboard API first (works on HTTPS/localhost)
      if (isSecureContext && navigator.clipboard && navigator.clipboard.readText) {
        try {
          const clipText = await navigator.clipboard.readText();
          const extractedId = extractLobbyIdFromUrl(clipText.trim());
          console.log(
            `Pasted from clipboard: "${clipText}" -> extracted: "${extractedId}"`,
          );

          setLobbyId(extractedId);
          if (lobbyIdInputRef.current) {
            lobbyIdInputRef.current.value = extractedId;
            lobbyIdInputRef.current.focus();
          }
          return;
        } catch (clipErr) {
          console.log("Clipboard API failed, trying fallbacks:", clipErr);
        }
      }

      // For HTTP or when clipboard API fails, use prompt immediately
      console.log("Using prompt fallback for clipboard access");
      const fallbackText = prompt("Please paste your lobby ID here:");
      if (fallbackText && fallbackText.trim()) {
        const extractedId = extractLobbyIdFromUrl(fallbackText.trim());
        console.log(`Manual input: "${fallbackText}" -> extracted: "${extractedId}"`);
        setLobbyId(extractedId);
        if (lobbyIdInputRef.current) {
          lobbyIdInputRef.current.value = extractedId;
          lobbyIdInputRef.current.focus();
        }
      }
    } catch (err) {
      console.error("Paste function failed: ", err);
      alert("Please manually type or copy-paste the lobby ID into the input field.");
    }
  };

  const joinLobby = async (targetLobbyId?: string): Promise<void> => {
    const targetId = targetLobbyId || lobbyId;
    console.log(
      `Joining lobby with ID: "${targetId}" (length: ${targetId.length})`,
    );

    if (!targetId) {
      console.error("Empty lobby ID provided");
      setMessage("Please enter a lobby ID");
      return;
    }

    setMessage(translateText("checking"));

    try {
      // First, check if the game exists in active lobbies
      const gameExists = await checkActiveLobby(targetId);
      if (gameExists) return;

      // If not active, check archived games
      const archivedGame = await checkArchivedGame(targetId);
      if (archivedGame) return;

      setMessage(translateText("not_found"));
    } catch (error) {
      console.error("Error checking lobby existence:", error);
      setMessage(translateText("error"));
    }
  };

  const checkActiveLobby = async (targetLobbyId: string): Promise<boolean> => {
    const config = await getServerConfigFromClient();
    const url = `/${config.workerPath(targetLobbyId)}/api/game/${targetLobbyId}/exists`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const json = await response.json();
    const gameInfo = WorkerApiGameIdExistsSchema.parse(json);

    if (gameInfo.exists) {
      setMessage(translateText("waiting"));
      setHasJoined(true);

      const clientID = generateID();
      console.log(
        `Dispatching join-lobby event with gameID: "${targetLobbyId}", clientID: "${clientID}"`,
      );

      onJoinLobby({
        gameID: targetLobbyId,
        clientID: clientID,
      });

      playersIntervalRef.current = setInterval(
        () => pollPlayers(targetLobbyId),
        1000,
      );
      return true;
    }

    return false;
  };

  const checkArchivedGame = async (targetLobbyId: string): Promise<boolean> => {
    const config = await getServerConfigFromClient();
    const archiveUrl = `/${config.workerPath(targetLobbyId)}/api/archived_game/${targetLobbyId}`;

    const archiveResponse = await fetch(archiveUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const json = await archiveResponse.json();
    const archiveData = WorkerApiArchivedGameLobbySchema.parse(json);

    if (
      archiveData.success === false &&
      archiveData.error === "Version mismatch"
    ) {
      console.warn(
        `Git commit hash mismatch for game ${targetLobbyId}`,
        archiveData.details,
      );
      setMessage(
        "This game was created with a different version. Cannot join.",
      );
      return true;
    }

    if (archiveData.exists) {
      onJoinLobby({
        gameID: targetLobbyId,
        gameRecord: archiveData.gameRecord,
        clientID: generateID(),
      });
      return true;
    }

    return false;
  };

  const pollPlayers = async (targetLobbyId: string) => {
    if (!targetLobbyId) return;
    const config = await getServerConfigFromClient();

    try {
      const response = await fetch(
        `/${config.workerPath(targetLobbyId)}/api/game/${targetLobbyId}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await response.json();
      const gameInfo = GameInfoSchema.parse(data);
      setPlayers(gameInfo.clients?.map((p) => p.username) ?? []);
    } catch (error) {
      console.error("Error polling players:", error);
    }
  };

  const handleClose = () => {
    setLobbyId("");
    setMessage("");
    setHasJoined(false);
    setPlayers([]);
    if (lobbyIdInputRef.current) {
      lobbyIdInputRef.current.value = "";
    }
    if (playersIntervalRef.current) {
      clearInterval(playersIntervalRef.current);
      playersIntervalRef.current = null;
    }
    onClose();
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === "Enter") {
      joinLobby();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} translationKey="Join lobby">
      <div className="space-y-6">
        <div className="lobby-id-box">
          <input
            ref={lobbyIdInputRef}
            type="text"
            id="lobbyIdInput"
            placeholder={translateText("enter_id")}
            onChange={handleChange}
            onKeyUp={handleKeyUp}
            className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded"
          />
          <button
            onClick={pasteFromClipboard}
            className="lobby-id-paste-button ml-2 p-2 bg-gray-600 hover:bg-gray-500 rounded"
          >
            <svg
              className="lobby-id-paste-button-icon"
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 32 32"
              height="18px"
              width="18px"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M 15 3 C 13.742188 3 12.847656 3.890625 12.40625 5 L 5 5 L 5 28 L 13 28 L 13 30 L 27 30 L 27 14 L 25 14 L 25 5 L 17.59375 5 C 17.152344 3.890625 16.257813 3 15 3 Z M 15 5 C 15.554688 5 16 5.445313 16 6 L 16 7 L 19 7 L 19 9 L 11 9 L 11 7 L 14 7 L 14 6 C 14 5.445313 14.445313 5 15 5 Z M 7 7 L 9 7 L 9 11 L 21 11 L 21 7 L 23 7 L 23 14 L 13 14 L 13 26 L 7 26 Z M 15 16 L 25 16 L 25 28 L 15 28 Z" />
            </svg>
          </button>
        </div>

        <div className={`message-area ${message ? "show" : ""}`}>{message}</div>

        {hasJoined && players.length > 0 && (
          <div className="options-section">
            <div className="option-title">
              {players.length}
              {players.length === 1
                ? translateText("player")
                : translateText("players")}
            </div>

            <div className="players-list">
              {players.map((player, index) => (
                <span key={index} className="player-tag">
                  {player}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          {!hasJoined && (
            <Button
              title={translateText("join_lobby")}
              block
              onClick={() => joinLobby()}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default JoinPrivateLobbyModal;

