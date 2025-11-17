type MatchPhase =
  | 'StartOfRound'
  | 'ApplyEnvironment'
  | 'ApplyPassiveStatus'
  | 'CommandPhase'
  | 'ResolutionPhase'
  | 'KOPhase'
  | 'EndOfRound';

type WeatherType = 'HotDry' | 'CoolDry' | 'LightRain' | 'HeavyRain' | 'Windy' | 'Cloudy';

interface Resistances {
  heat: number;
  cold: number;
  dry: number;
  wet: number;
  wind: number;
  salt: number;
}

interface StatusEffect {
  type: string;
  duration: number;
  stacks: number;
}

interface MatchViewFloran {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  currentWater: number;
  capacity: number;
  surface: number;
  initiative: number;
  offense: number;
  defense: number;
  resistances: Resistances;
  overWaterStacks: number;
  rootRot: boolean;
  statuses: StatusEffect[];
}

interface MatchLogEntry {
  round: number;
  phase: MatchPhase;
  message: string;
  details?: Record<string, unknown>;
}

interface MatchView {
  round: number;
  phase: MatchPhase;
  weather: WeatherType;
  florans: [MatchViewFloran, MatchViewFloran];
  logs: MatchLogEntry[];
  isFinished: boolean;
  winnerIndex: 0 | 1 | null;
  koReason?: string;
}

type MatchMode = 'PVE_BOT' | 'PVP_CASUAL' | 'PVP_RANKED';
type AIDifficulty = 'easy' | 'normal' | 'hard';

type ServerEnvelopeMeta = {
  id: string;
  seq?: number;
  ts?: string;
};

type ServerMessagePayload =
  | { type: 'auth/ok'; payload: { userId: string; sessionId: string } }
  | { type: 'auth/error'; payload: { code: string; message: string } }
  | { type: 'match/queued'; payload: { mode: MatchMode } }
  | { type: 'match/found'; payload: { matchId: string; mode: MatchMode; opponent?: { userId: string } } }
  | { type: 'match/state'; payload: { matchId: string; state: MatchView } }
  | { type: 'match/result'; payload: { matchId: string; state: MatchView } }
  | { type: 'system/ping'; payload: Record<string, never> }
  | { type: 'error'; payload: { code: string; message: string } };

type ServerMessage = ServerEnvelopeMeta & ServerMessagePayload;

type ClientCommand = {
  type: 'ATTACK' | 'ITEM';
  targetIndex?: number;
  itemId?: string;
};

type ClientEnvelopeMeta = {
  id: string;
  seq?: number;
  ts?: string;
};

type ClientMessagePayload =
  | { type: 'auth/hello'; payload: { token: string; sessionId?: string } }
  | { type: 'match/queue'; payload: { mode: MatchMode; speciesId?: string; difficulty?: AIDifficulty } }
  | { type: 'match/cancelQueue'; payload: { mode: MatchMode } }
  | { type: 'match/command'; payload: { matchId: string; command: ClientCommand } }
  | { type: 'system/pong'; payload: Record<string, never> };

type ClientMessage = ClientEnvelopeMeta & ClientMessagePayload;

type Route = 'home' | 'play' | 'team' | 'inventory' | 'shop' | 'market' | 'events' | 'settings';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'AUTHENTICATING' | 'READY';

interface AppState {
  route: Route;
  userId: string | null;
  sessionId: string | null;
  bc: number;
  connectionStatus: ConnectionStatus;
  matchId: string | null;
  lastMatchState: MatchView | null;
}

const state: AppState = {
  route: 'home',
  userId: null,
  sessionId: null,
  bc: 0,
  connectionStatus: 'DISCONNECTED',
  matchId: null,
  lastMatchState: null,
};

let socket: WebSocket | null = null;
let outSeq = 0;

function qs<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) {
    throw new Error(`Missing element: ${selector}`);
  }
  return el as T;
}

function setTopbarStatus(): void {
  const userEl = qs<HTMLSpanElement>('#topbar-user');
  const bcEl = qs<HTMLSpanElement>('#topbar-bc');
  const wsEl = qs<HTMLSpanElement>('#topbar-ws');

  userEl.textContent = state.userId ?? 'Guest';
  bcEl.textContent = `BC: ${state.bc}`;
  wsEl.textContent =
    state.connectionStatus === 'READY'
      ? 'WS: ready'
      : state.connectionStatus === 'AUTHENTICATING'
        ? 'WS: authenticating'
        : state.connectionStatus === 'CONNECTING'
          ? 'WS: connecting'
          : 'WS: disconnected';
}

function setNavActive(route: Route): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.nav-button');
  buttons.forEach((btn) => {
    const r = btn.dataset.route as Route | undefined;
    btn.classList.toggle('active', r === route);
  });
}

function setStatusBanner(message: string, isError = false): void {
  const banner = document.querySelector<HTMLDivElement>('#status-banner');
  if (!banner) return;
  banner.textContent = message;
  banner.className = 'status-banner' + (isError ? ' error' : '');
}

function renderHomeView(root: HTMLElement): void {
  root.innerHTML = `
    <div class="card">
      <h2>Welcome to BioStrike</h2>
      <p>Prototype client shell with navigation and a basic play view.</p>
      <div style="margin-top:0.75rem;">
        <button id="home-play" class="nav-button" style="width:auto;">Play now</button>
      </div>
    </div>
  `;

  const playBtn = qs<HTMLButtonElement>('#home-play');
  playBtn.addEventListener('click', () => navigate('play'));
}

function renderPlayView(root: HTMLElement): void {
  root.innerHTML = `
    <div id="status-banner" class="status-banner"></div>
    <div class="card" style="margin-top:0.5rem;">
      <div class="controls">
        <button id="btn-connect">Connect</button>
        <button id="btn-start" disabled>Start match</button>
        <button id="btn-attack" disabled>Attack</button>
        <button id="btn-item" disabled>Use item</button>
      </div>
      <div style="margin:0.5rem 0;">
        <label>
          Your Floran:
          <select id="select-species">
            <option value="sunflower">Sunflower</option>
            <option value="cactus">Cactus</option>
            <option value="aloe">Aloe</option>
            <option value="water_lily">Water Lily</option>
            <option value="bamboo">Bamboo</option>
            <option value="sundew">Sundew</option>
          </select>
        </label>
        <label style="margin-left:0.75rem;">
          Item:
          <select id="select-item">
            <option value="">(no item)</option>
            <option value="watering_can">Watering can (+water)</option>
            <option value="mulch">Mulch (-transpiration)</option>
          </select>
        </label>
      </div>
      <div id="battle"></div>
    </div>
    <div class="card">
      <div class="log" id="log"></div>
    </div>
  `;

  const btnConnect = qs<HTMLButtonElement>('#btn-connect');
  const btnStart = qs<HTMLButtonElement>('#btn-start');
  const btnAttack = qs<HTMLButtonElement>('#btn-attack');
  const btnItem = qs<HTMLButtonElement>('#btn-item');
  const selectSpecies = qs<HTMLSelectElement>('#select-species');
  const selectItem = qs<HTMLSelectElement>('#select-item');

  btnConnect.addEventListener('click', () => {
    connectWebSocket();
  });

  btnStart.addEventListener('click', () => {
    const playerSpeciesId = selectSpecies.value || 'sunflower';
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatusBanner('Not connected.', true);
      return;
    }
    const msg: ClientMessage = {
      id: `cli_${Date.now().toString(36)}_${(++outSeq).toString(36)}`,
      seq: outSeq,
      ts: new Date().toISOString(),
      type: 'match/queue',
      payload: { mode: 'PVE_BOT', speciesId: playerSpeciesId, difficulty: 'easy' },
    };
    socket.send(JSON.stringify(msg));
    btnStart.disabled = true;
    setStatusBanner('Queued for PVE_BOT match ...');
  });

  btnAttack.addEventListener('click', () => {
    if (!state.matchId) {
      setStatusBanner('No active match.', true);
      return;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatusBanner('Not connected.', true);
      return;
    }
    const msg: ClientMessage = {
      id: `cli_${Date.now().toString(36)}_${(++outSeq).toString(36)}`,
      seq: outSeq,
      ts: new Date().toISOString(),
      type: 'match/command',
      payload: { matchId: state.matchId, command: { type: 'ATTACK', targetIndex: 1 } },
    };
    socket.send(JSON.stringify(msg));
  });

  btnItem.addEventListener('click', () => {
    const itemId = selectItem.value;
    if (!itemId) {
      setStatusBanner('Please select an item first.', true);
      return;
    }
    if (!state.matchId) {
      setStatusBanner('No active match.', true);
      return;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatusBanner('Not connected.', true);
      return;
    }

    const msg: ClientMessage = {
      id: `cli_${Date.now().toString(36)}_${(++outSeq).toString(36)}`,
      seq: outSeq,
      ts: new Date().toISOString(),
      type: 'match/command',
      payload: {
        matchId: state.matchId,
        command: { type: 'ITEM', targetIndex: 0, itemId },
      },
    };
    socket.send(JSON.stringify(msg));
  });

  selectItem.addEventListener('change', () => {
    const canAct = !!state.lastMatchState && !state.lastMatchState.isFinished;
    btnItem.disabled = !canAct || !selectItem.value;
  });

  // Initial button state based on current match.
  const canAct = !!state.lastMatchState && !state.lastMatchState.isFinished;
  btnStart.disabled = state.connectionStatus !== 'READY';
  btnAttack.disabled = !canAct;
  btnItem.disabled = !canAct || !selectItem.value;
}

function renderPlaceholderView(root: HTMLElement, title: string, description: string): void {
  root.innerHTML = `
    <div class="card">
      <h2>${title}</h2>
      <p>${description}</p>
    </div>
  `;
}

function renderRoute(): void {
  const root = qs<HTMLElement>('#view-root');
  setNavActive(state.route);
  setTopbarStatus();

  switch (state.route) {
    case 'home':
      renderHomeView(root);
      break;
    case 'play':
      renderPlayView(root);
      break;
    case 'team':
      renderPlaceholderView(
        root,
        'Team-Builder / Herbarium',
        'Team management and Herbarium UI will live here.',
      );
      break;
    case 'inventory':
      renderPlaceholderView(
        root,
        'Inventory',
        'Inventory view for items, Floran boxes, bann cores and cosmetics.',
      );
      break;
    case 'shop':
      renderPlaceholderView(
        root,
        'Shop',
        'NPC shop for essentials and cosmetics (hooked to backend /shop).',
      );
      break;
    case 'market':
      renderPlaceholderView(
        root,
        'Market',
        'Player-to-player market UI (offers, filters, details).',
      );
      break;
    case 'events':
      renderPlaceholderView(
        root,
        'Events & Quests',
        'LiveOps events and quest lists will be rendered here.',
      );
      break;
    case 'settings':
      renderPlaceholderView(
        root,
        'Settings',
        'Client settings (audio, graphics, UI, telemetry) will be configurable here.',
      );
      break;
  }
}

function navigate(route: Route): void {
  state.route = route;
  renderRoute();
}

function renderBattle(stateView: MatchView): void {
  const battleEl = document.querySelector<HTMLDivElement>('#battle');
  if (!battleEl) return;

  const [you, enemy] = stateView.florans;
  const weatherText: Record<WeatherType, string> = {
    HotDry: 'Hot & Dry',
    CoolDry: 'Cool & Dry',
    LightRain: 'Light Rain',
    HeavyRain: 'Heavy Rain',
    Windy: 'Windy',
    Cloudy: 'Cloudy',
  };

  const renderBars = (floran: MatchViewFloran): string => {
    const hpPct = Math.max(0, Math.min(100, (floran.hp / floran.maxHp) * 100));
    const waterPct = Math.max(0, Math.min(100, (floran.currentWater / floran.capacity) * 100));

    return `
      <div><strong>${floran.name}</strong></div>
      <div>HP: ${floran.hp} / ${floran.maxHp}</div>
      <div class="bar"><div class="bar-fill-hp" style="width:${hpPct}%"></div></div>
      <div>Water: ${Math.round(floran.currentWater)} / ${floran.capacity}</div>
      <div class="bar"><div class="bar-fill-water" style="width:${waterPct}%"></div></div>
      <div style="margin-top:0.25rem;">
        <span class="pill">Surface ${floran.surface.toFixed(2)}</span>
        <span class="pill">Init ${floran.initiative}</span>
        <span class="pill">Stacks ${floran.overWaterStacks}</span>
        ${floran.rootRot ? '<span class="pill">Root Rot</span>' : ''}
      </div>
    `;
  };

  battleEl.innerHTML = `
    <div style="margin-bottom:0.5rem;">
      <span class="pill">Round ${stateView.round}</span>
      <span class="pill">Phase ${stateView.phase}</span>
      <span class="pill">Weather: ${weatherText[stateView.weather]}</span>
      ${
        stateView.isFinished
          ? `<span class="pill">Result: ${
              stateView.winnerIndex === 0 ? 'Win' : stateView.winnerIndex === 1 ? 'Loss' : 'Draw'
            }</span>`
          : ''
      }
    </div>
    <div class="floran-row">
      <div style="flex:1; margin-right:1rem;">
        <h4>You</h4>
        ${renderBars(you)}
      </div>
      <div style="flex:1;">
        <h4>Opponent</h4>
        ${renderBars(enemy)}
      </div>
    </div>
  `;
}

function renderLogs(stateView: MatchView): void {
  const logEl = document.querySelector<HTMLDivElement>('#log');
  if (!logEl) return;

  const lines = stateView.logs.map((entry) => {
    const phase = entry.phase.padEnd(18, ' ');
    return `[R${entry.round.toString().padStart(2, '0')}] ${phase} :: ${entry.message}`;
  });

  logEl.textContent = lines.join('\n');
  logEl.scrollTop = logEl.scrollHeight;
}

function handleServerMessage(message: ServerMessage): void {
  if (message.type === 'auth/ok') {
    state.userId = message.payload.userId;
    state.sessionId = message.payload.sessionId;
    state.connectionStatus = 'READY';
    setTopbarStatus();
    setStatusBanner(`Authenticated as ${message.payload.userId}.`);
    const btnStart = document.querySelector<HTMLButtonElement>('#btn-start');
    if (btnStart) {
      btnStart.disabled = false;
    }
    return;
  }

  if (message.type === 'system/ping') {
    const pong: ClientMessage = {
      id: `cli_${Date.now().toString(36)}_${(++outSeq).toString(36)}`,
      seq: outSeq,
      ts: new Date().toISOString(),
      type: 'system/pong',
      payload: {},
    };
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(pong));
    }
    return;
  }

  if (message.type === 'auth/error') {
    setStatusBanner(`Auth error: ${message.payload.message}`, true);
    state.connectionStatus = 'DISCONNECTED';
    setTopbarStatus();
    return;
  }

  if (message.type === 'error') {
    setStatusBanner(`Error: ${message.payload.message}`, true);
    return;
  }

  if (message.type === 'match/queued') {
    setStatusBanner(`Queued for ${message.payload.mode} ...`);
    return;
  }

  if (message.type === 'match/found') {
    state.matchId = message.payload.matchId;
    setStatusBanner(`Match found (${message.payload.mode}).`);
    return;
  }

  if (message.type === 'match/state') {
    state.matchId = message.payload.matchId;
    state.lastMatchState = message.payload.state;
    renderBattle(message.payload.state);
    renderLogs(message.payload.state);

    const canAct = !message.payload.state.isFinished;
    const btnAttack = document.querySelector<HTMLButtonElement>('#btn-attack');
    const btnItem = document.querySelector<HTMLButtonElement>('#btn-item');
    const selectItem = document.querySelector<HTMLSelectElement>('#select-item');

    if (btnAttack) btnAttack.disabled = !canAct;
    if (btnItem) btnItem.disabled = !canAct || !selectItem?.value;
    const btnStart = document.querySelector<HTMLButtonElement>('#btn-start');
    if (btnStart) btnStart.disabled = false;
    return;
  }

  if (message.type === 'match/result') {
    state.lastMatchState = message.payload.state;
    renderBattle(message.payload.state);
    renderLogs(message.payload.state);
    setStatusBanner('Match finished.');
    state.matchId = null;
    const btnAttack = document.querySelector<HTMLButtonElement>('#btn-attack');
    const btnItem = document.querySelector<HTMLButtonElement>('#btn-item');
    if (btnAttack) btnAttack.disabled = true;
    if (btnItem) btnItem.disabled = true;
    return;
  }
}

function connectWebSocket(): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    setStatusBanner('Already connected.');
    return;
  }

  state.connectionStatus = 'CONNECTING';
  setTopbarStatus();
  setStatusBanner('Connecting to ws://localhost:3000 ...');

  socket = new WebSocket('ws://localhost:3000');

  socket.addEventListener('open', () => {
    state.connectionStatus = 'AUTHENTICATING';
    setTopbarStatus();
    const token = `guest_${Math.random().toString(36).slice(2, 8)}`;
    const msg: ClientMessage = {
      id: `cli_${Date.now().toString(36)}_${(++outSeq).toString(36)}`,
      seq: outSeq,
      ts: new Date().toISOString(),
      type: 'auth/hello',
      payload: { token, sessionId: state.sessionId ?? undefined },
    };
    socket?.send?.(JSON.stringify(msg));
    setStatusBanner('Connected. Authenticating ...');
  });

  socket.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(event.data as string) as ServerMessage;
      handleServerMessage(parsed);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Invalid message', err);
    }
  });

  socket.addEventListener('close', () => {
    setStatusBanner('Connection closed.', true);
    state.connectionStatus = 'DISCONNECTED';
    setTopbarStatus();
    const btnStart = document.querySelector<HTMLButtonElement>('#btn-start');
    const btnAttack = document.querySelector<HTMLButtonElement>('#btn-attack');
    const btnItem = document.querySelector<HTMLButtonElement>('#btn-item');
    if (btnStart) btnStart.disabled = true;
    if (btnAttack) btnAttack.disabled = true;
    if (btnItem) btnItem.disabled = true;
    socket = null;
    state.matchId = null;
  });

  socket.addEventListener('error', () => {
    setStatusBanner('WebSocket error.', true);
  });
}

function initNavigation(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.nav-button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.route as Route | undefined;
      if (route) {
        navigate(route);
      }
    });
  });
}

function init(): void {
  initNavigation();
  renderRoute();
}

init();

