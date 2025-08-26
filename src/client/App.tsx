import React, { useEffect, useState } from 'react';

import { EventBus } from '../core/EventBus';
import { UserMeResponse } from '../core/ApiSchemas';
import { GameRecord, GameStartInfo, ID } from '../core/Schemas';
import { ServerConfig } from '../core/configuration/Config';
import { GameType } from '../core/game/Game';
import { UserSettings } from '../core/game/UserSettings';
import { getServerConfigFromClient } from '../core/configuration/ConfigLoader';
import { joinLobby } from './ClientGameRunner';
import { SendKickPlayerIntentEvent } from './Transport';
import { generateCryptoRandomUUID, incrementGamesPlayed, translateText } from './Utils';
import { discordLogin, getUserMe, isLoggedIn, logOut } from './jwt';

import Button from './components/Button';
import DarkModeButton from './components/DarkModeButton';
import FlagInput from './components/FlagInput';
import LangSelector from './components/LangSelector';
// NewsButton temporarily commented out due to import issues
// import NewsButton from './components/NewsButton';
import PublicLobby from './components/PublicLobby';
import UsernameInput from './components/UsernameInput';
import version from '../../resources/version.txt';

import './styles.css';

export type JoinLobbyEvent = {
  clientID: string;
  gameID: string;
  gameStartInfo?: GameStartInfo;
  gameRecord?: GameRecord;
};

export type KickPlayerEvent = {
  target: string;
};

declare global {
  interface Window {
    PageOS: {
      session: {
        newPageView: () => void;
      };
    };
    ramp: {
      que: Array<() => void>;
      passiveMode: boolean;
      spaAddAds: (ads: Array<{ type: string; selectorId: string }>) => void;
      destroyUnits: (adType: string) => void;
      settings?: {
        slots?: unknown;
      };
      spaNewPage: (url: string) => void;
    };
  }
}

const App: React.FC = () => {
  const [gameStop, setGameStop] = useState<(() => void) | null>(null);
  const [userMeResponse, setUserMeResponse] = useState<UserMeResponse | false>(false);
  const [isLoggedInState, setIsLoggedInState] = useState(false);
  const [username, setUsername] = useState('Player');
  const [selectedFlag, setSelectedFlag] = useState('xx');
  const [selectedPattern, setSelectedPattern] = useState('');
  const [isUsernameValid, setIsUsernameValid] = useState(true);

  const eventBus = new EventBus();
  const userSettings = new UserSettings();

  useEffect(() => {
    const gameVersionEl = document.getElementById('game-version') as HTMLDivElement;
    if (gameVersionEl) {
      gameVersionEl.innerText = version;
    }

    // Set up dark mode
    if (userSettings.darkMode()) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Handle authentication
    if (isLoggedIn() === false) {
      onUserMe(false);
    } else {
      getUserMe().then(onUserMe);
    }

    // Handle hash-based navigation
    handleHash();

    // Event listeners
    const handleHashChange = () => {
      if (gameStop !== null) {
        handleLeaveLobby();
      }
      handleHash();
    };

    window.addEventListener('popstate', handleHashChange);
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('beforeunload', () => {
      if (gameStop !== null) {
        gameStop();
      }
    });

    return () => {
      window.removeEventListener('popstate', handleHashChange);
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('beforeunload', handleHashChange);
    };
  }, []);

  const onUserMe = async (response: UserMeResponse | false) => {
    const config = await getServerConfigFromClient();
    
    if (!hasAllowedFlare(response, config)) {
      if (response === false) {
        // Login required
        // eslint-disable-next-line max-len
        document.body.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; background-size: cover; background-position: center;">
            <div style="background-color: rgba(0, 0, 0, 0.7); color: white; padding: 2em; margin: 5em; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);">
              <p style="margin-bottom: 1em;">${translateText('auth.login_required')}</p>
              <p style="margin-bottom: 1.5em;">${translateText('auth.redirecting')}</p>
              <div style="width: 100%; height: 8px; background-color: #444; border-radius: 4px; overflow: hidden;">
                <div style="height: 100%; width: 0%; background-color: #4caf50; animation: fillBar 5s linear forwards;"></div>
              </div>
            </div>
          </div>
          <div class="bg-image"></div>
          <style>
            @keyframes fillBar {
              from { width: 0%; }
              to { width: 100%; }
            }
          </style>
        `;
        setTimeout(discordLogin, 5000);
      } else {
        // Unauthorized
        // eslint-disable-next-line max-len
        document.body.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; background-size: cover; background-position: center;">
            <div style="background-color: rgba(0, 0, 0, 0.7); color: white; padding: 2em; margin: 5em; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);">
              <p style="margin-bottom: 1em;">${translateText('auth.not_authorized')}</p>
              <p>${translateText('auth.contact_admin')}</p>
            </div>
          </div>
          <div class="bg-image"></div>
        `;
      }
      return;
    }

    setUserMeResponse(response);
    setIsLoggedInState(response !== false);
  };

  const handleHash = () => {
    const { hash } = window.location;

    const alertAndStrip = (message: string) => {
      alert(message);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    };

    if (hash.startsWith('#')) {
      const params = new URLSearchParams(hash.slice(1));
      if (params.get('purchase-completed') === 'true') {
        alertAndStrip('purchase succeeded');
        return;
      } else if (params.get('purchase-completed') === 'false') {
        alertAndStrip('purchase failed');
        return;
      }
      const lobbyId = params.get('join');
      if (lobbyId && ID.safeParse(lobbyId).success) {
        // Handle join lobby logic here
        console.log(`joining lobby ${lobbyId}`);
      }
    }
  };

  const handleJoinLobby = async (event: JoinLobbyEvent) => {
    console.log(`joining lobby ${event.gameID}`);
    
    // Validate required fields before joining
    if (!username || username.trim() === '') {
      console.error('Username is required to join a lobby');
      alert('Please enter a username before joining a lobby.');
      return;
    }
    
    if (!event.gameID) {
      console.error('Invalid game ID');
      return;
    }
    
    if (gameStop !== null) {
      console.log('joining lobby, stopping existing game');
      gameStop();
    }
    const config = await getServerConfigFromClient();

    const stopFunction = joinLobby(
      eventBus,
      {
        gameID: event.gameID,
        serverConfig: config,
        pattern: userSettings.getSelectedPattern(),
        flag: selectedFlag === 'xx' ? undefined : selectedFlag,
        playerName: username.trim(),
        token: getPlayToken(),
        clientID: event.clientID,
        gameStartInfo: event.gameStartInfo ?? event.gameRecord?.info,
        gameRecord: event.gameRecord,
      },
      () => {
        console.log('Closing modals');
        document.getElementById('settings-button')?.classList.add('hidden');
        document.getElementById('username-validation-error')?.classList.add('hidden');
      },
      () => {
        incrementGamesPlayed();
        try {
          window.PageOS.session.newPageView();
        } catch (e) {
          console.error('Error calling newPageView', e);
        }
        
        if (event.gameStartInfo?.config.gameType !== GameType.Singleplayer) {
          history.pushState(null, '', `#join=${event.gameID}`);
        }
      }
    );
    
    setGameStop(() => stopFunction);
  };

  const handleLeaveLobby = () => {
    if (gameStop === null) return;
    console.log('leaving lobby, cancelling game');
    gameStop();
    setGameStop(null);
  };

  const handleKickPlayer = (event: KickPlayerEvent) => {
    if (eventBus) {
      eventBus.emit(new SendKickPlayerIntentEvent(event.target));
    }
  };

  const handleLogin = () => {
    discordLogin();
  };

  const handleLogout = () => {
    logOut();
    onUserMe(false);
  };

  return (
    <>
      <header className="l-header">
        <div className="l-header__content">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1364 259"
            width="100%"
            height="100%"
            fill="currentColor"
            className="l-header__logo"
          >
            <defs>
              <linearGradient
                id="logo-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" style={{ stopColor: '#2563eb' }} />
                <stop offset="100%" style={{ stopColor: '#3b82f6' }} />
              </linearGradient>
            </defs>
            <g>
              <path d="M0,174V51h15.24v-17.14h16.81v-16.98h16.96V0h1266v17.23h17.13v16.81h16.98v16.96h14.88v123h-15.13v17.08h-17.08v17.08h-16.9v17.04H324.9v16.86h-16.9v16.95h-102v-17.12h-17.07v-17.05H48.73v-17.05h-16.89v-16.89H14.94v-16.89H0ZM1297.95,17.35H65.9v16.7h-17.08v17.08h-14.5v123.08h14.85v16.9h17.08v17.08h139.9v17.08h17.08v16.36h67.9v-16.72h17.08v-17.07h989.88v-17.07h17.08v-16.9h14.44V50.8h-14.75v-17.08h-16.9v-16.37Z" />
            </g>
          </svg>
          <div id="game-version" className="l-header__highlightText text-center">
            Loading version...
          </div>
        </div>
      </header>
      
      <div className="bg-image"></div>
      
      <main className="flex justify-center flex-grow">
        <div className="container pt-12">
          {!isLoggedInState ? (
            <Button
              title="Initializing..."
              onClick={handleLogin}
              block
              disabled={false}
            />
          ) : (
            <Button
              title="Log out"
              translationKey="main.log_out"
              onClick={handleLogout}
              block
            />
          )}

          <div className="container__row">
            <FlagInput
              className="w-[20%] md:w-[15%]"
              selectedFlag={selectedFlag}
              onFlagChange={setSelectedFlag}
            />
            <div className="w-[20%] md:w-[15%]">
              {/* Territory patterns modal will go here */}
            </div>
            <UsernameInput
              className="relative w-full"
              value={username}
              onChange={setUsername}
              onValidationChange={setIsUsernameValid}
            />
            {/* <NewsButton className="w-[20%] md:w-[15%] component-hideable" /> */}
            <div className="w-[20%] md:w-[15%] component-hideable">
              <Button
                title="News"
                onClick={() => {}}
                secondary
                block
              />
            </div>
          </div>

          <div>
            <PublicLobby onJoinLobby={handleJoinLobby} />
          </div>

          <div className="container__row container__row--equal">
            <Button
              title="Create Lobby"
              translationKey="main.create_lobby"
              onClick={() => {
                if (isUsernameValid) {
                  // Handle host lobby
                }
              }}
              block
              secondary
            />
            <Button
              title="Join Lobby"
              translationKey="main.join_lobby"
              onClick={() => {
                if (isUsernameValid) {
                  // Handle join private lobby
                }
              }}
              block
              secondary
            />
          </div>

          <Button
            id="single-player"
            title="Single Player"
            translationKey="main.single_player"
            onClick={() => {
              if (isUsernameValid) {
                // Handle single player
              }
            }}
            block
          />

          <Button
            title="Instructions"
            translationKey="main.instructions"
            onClick={() => {
              // Handle help modal
            }}
            block
            secondary
          />
          
          <div className="container__row">
            <LangSelector className="w-full" />
          </div>
        </div>
      </main>

      <button
        id="settings-button"
        title="Settings"
        className="fixed bottom-4 right-4 z-50 rounded-full p-2 shadow-lg transition-colors duration-300 flex items-center justify-center"
        style={{ width: '80px', height: '80px', backgroundColor: '#0075ff' }}
        onClick={() => {
          // Handle settings modal
        }}
      >
        <img
          src="../../resources/images/SettingIconWhite.svg"
          alt="Settings"
          style={{ width: '72px', height: '72px' }}
        />
      </button>

      <DarkModeButton />

      <footer className="l-footer">
        <div className="l-footer__content">
          <div className="l-footer__col">
            <a
              href="https://youtu.be/jvHEvbko3uw?si=znspkP84P76B1w5I"
              data-i18n="main.how_to_play"
              className="t-link"
              target="_blank"
            >
              How to Play
            </a>
            <a
              href="https://openfront.miraheze.org/wiki/Main_Page"
              data-i18n="main.wiki"
              className="t-link"
              target="_blank"
            >
              Wiki
            </a>
            <a
              target="_blank"
              href="https://discord.gg/jRpxXvG42t"
              className="t-link"
            >
              <span data-i18n="main.join_discord">Join the Discord!</span>
            </a>
          </div>
          <div className="l-footer__col t-text-white">
            <a
              href="https://github.com/openfrontio/OpenFrontIO"
              className="t-link inline-flex items-center space-x-2"
              target="_blank"
            >
              ©2025 OpenFront™
              <img
                src="../../resources/icons/github-mark-white.svg"
                alt="GitHub"
                width="20"
                height="20"
                className="ml-2 mr-4"
              />
            </a>
            <a
              href="/privacy-policy.html"
              data-i18n="main.privacy_policy"
              className="t-link"
              target="_blank"
            >
              Privacy Policy
            </a>
            <a
              href="/terms-of-service.html"
              data-i18n="main.terms_of_service"
              className="t-link"
              target="_blank"
            >
              Terms of Service
            </a>
            <p style={{ textAlign: 'center' }}>
              <a
                href="https://www.playwire.com/contact-direct-sales"
                data-i18n="main.advertise"
                className="t-link"
                target="_blank"
                rel="noopener"
              >
                Advertise
              </a>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};

// WARNING: DO NOT EXPOSE THIS ID
function getPlayToken(): string {
  const result = isLoggedIn();
  if (result !== false) return result.token;
  return getPersistentIDFromCookie();
}

// WARNING: DO NOT EXPOSE THIS ID
export function getPersistentID(): string {
  const result = isLoggedIn();
  if (result !== false) return result.claims.sub;
  return getPersistentIDFromCookie();
}

// WARNING: DO NOT EXPOSE THIS ID
function getPersistentIDFromCookie(): string {
  const COOKIE_NAME = 'player_persistent_id';

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=').map((c) => c.trim());
    if (cookieName === COOKIE_NAME) {
      return cookieValue;
    }
  }

  const newID = generateCryptoRandomUUID();
  document.cookie = [
    `${COOKIE_NAME}=${newID}`,
    `max-age=${5 * 365 * 24 * 60 * 60}`,
    'path=/',
    'SameSite=Strict',
    'Secure',
  ].join(';');

  return newID;
}

function hasAllowedFlare(
  userMeResponse: UserMeResponse | false,
  config: ServerConfig
) {
  const allowed = config.allowedFlares();
  if (allowed === undefined) return true;
  if (userMeResponse === false) return false;
  const { flares } = userMeResponse.player;
  if (flares === undefined) return false;
  return allowed.length === 0 || allowed.some((f) => flares.includes(f));
}

export default App;