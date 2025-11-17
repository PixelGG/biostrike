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
  | { type: 'chat/message'; payload: { channel: string; userId: string; message: string; at: string } }
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
  | { type: 'chat/send'; payload: { channel: string; message: string } }
  | { type: 'system/pong'; payload: Record<string, never> };

type ClientMessage = ClientEnvelopeMeta & ClientMessagePayload;

let socket: WebSocket | null = null;
let lastMatchState: MatchView | null = null;
let currentMatchId: string | null = null;
let userId: string | null = null;
let sessionId: string | null = null;
let outSeq = 0;

function qs<T extends Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) {
    throw new Error(`Missing element: ${selector}`);
  }
  return el as T;
}

const statusEl = qs<HTMLDivElement>('#status');
const battleEl = qs<HTMLDivElement>('#battle');
const logEl = qs<HTMLDivElement>('#log');
const btnConnect = qs<HTMLButtonElement>('#btn-connect');
const btnStart = qs<HTMLButtonElement>('#btn-start');
const btnAttack = qs<HTMLButtonElement>('#btn-attack');
const btnItem = qs<HTMLButtonElement>('#btn-item');
const selectSpecies = qs<HTMLSelectElement>('#select-species');
const selectItem = qs<HTMLSelectElement>('#select-item');

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function renderBars(floran: MatchViewFloran): string {
  const hpPct = Math.max(0, Math.min(100, (floran.hp / floran.maxHp) * 100));
  const waterPct = Math.max(0, Math.min(100, (floran.currentWater / floran.capacity) * 100));

  return `
    <div><strong>${floran.name}</strong></div>
    <div>HP: ${floran.hp} / ${floran.maxHp}</div>
    <div class="bar"><div class="bar-fill-hp" style="width:${hpPct}%"></div></div>
    <div>Wasser: ${Math.round(floran.currentWater)} / ${floran.capacity}</div>
    <div class="bar"><div class="bar-fill-water" style="width:${waterPct}%"></div></div>
    <div style="margin-top:0.25rem;">
      <span class="pill">Surface ${floran.surface.toFixed(2)}</span>
      <span class="pill">Init ${floran.initiative}</span>
      <span class="pill">Stacks ${floran.overWaterStacks}</span>
      ${floran.rootRot ? '<span class="pill">Wurzelrot</span>' : ''}
    </div>
  `;
}

function renderBattle(state: MatchView): void {
  const [you, enemy] = state.florans;
  const weatherText: Record<WeatherType, string> = {
    HotDry: 'Heiß & Trocken',
    CoolDry: 'Kühl & Trocken',
    LightRain: 'Leichter Regen',
    HeavyRain: 'Starker Regen',
    Windy: 'Windig',
    Cloudy: 'Bewölkt',
  };

  battleEl.innerHTML = `
    <div style="margin-bottom:0.5rem;">
      <span class="pill">Runde ${state.round}</span>
      <span class="pill">Phase ${state.phase}</span>
      <span class="pill">Wetter: ${weatherText[state.weather]}</span>
      ${
        state.isFinished
          ? `<span class="pill">Matchende (${state.winnerIndex === 0 ? 'Sieg' : state.winnerIndex === 1 ? 'Niederlage' : 'Unentschieden'})</span>`
          : ''
      }
    </div>
    <div class="floran-row">
      <div style="flex:1; margin-right:1rem;">
        <h4>Du</h4>
        ${renderBars(you)}
      </div>
      <div style="flex:1;">
        <h4>Gegner</h4>
        ${renderBars(enemy)}
      </div>
    </div>
  `;
}

function renderLogs(state: MatchView): void {
  const lines = state.logs.map((entry) => {
    const phase = entry.phase.padEnd(18, ' ');
    return `[R${entry.round.toString().padStart(2, '0')}] ${phase} :: ${entry.message}`;
  });

  logEl.textContent = lines.join('\n');
  logEl.scrollTop = logEl.scrollHeight;
}

function handleServerMessage(message: ServerMessage): void {
  if (message.type === 'auth/ok') {
    userId = message.payload.userId;
    sessionId = message.payload.sessionId;
    setStatus(`Angemeldet als ${userId} (Session ${sessionId}).`);
    btnStart.disabled = false;
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
    sendClientMessage(pong);
    return;
  }

  if (message.type === 'auth/error') {
    setStatus(`Auth-Fehler: ${message.payload.message}`);
    return;
  }

  if (message.type === 'error') {
    setStatus(`Fehler: ${message.payload.message}`);
    return;
  }

  if (message.type === 'match/queued') {
    setStatus(`In Warteschlange (${message.payload.mode}) ...`);
    return;
  }

  if (message.type === 'match/found') {
    currentMatchId = message.payload.matchId;
    setStatus(`Match gefunden (${message.payload.mode}).`);
    return;
  }

  if (message.type === 'match/state') {
    currentMatchId = message.payload.matchId;
    lastMatchState = message.payload.state;
    renderBattle(message.payload.state);
    renderLogs(message.payload.state);

    const canAct = !message.payload.state.isFinished;
    btnAttack.disabled = !canAct;
    btnItem.disabled = !canAct || !selectItem.value;
    btnStart.disabled = false;
    return;
  }

  if (message.type === 'match/result') {
    lastMatchState = message.payload.state;
    renderBattle(message.payload.state);
    renderLogs(message.payload.state);
    setStatus('Match beendet.');
    currentMatchId = null;
    btnAttack.disabled = true;
    btnItem.disabled = true;
    return;
  }

  if (message.type === 'chat/message') {
    // Chat wird aktuell nicht visualisiert, könnte später ergänzt werden.
    return;
  }
}

function connect(): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return;
  }

  setStatus('Verbinde zu ws://localhost:3000 ...');

  socket = new WebSocket('ws://localhost:3000');

  socket.addEventListener('open', () => {
    const token = `guest_${Math.random().toString(36).slice(2, 8)}`;
    const msg: ClientMessage = {
      id: `cli_${Date.now().toString(36)}_${(++outSeq).toString(36)}`,
      seq: outSeq,
      ts: new Date().toISOString(),
      type: 'auth/hello',
      payload: { token, sessionId: sessionId ?? undefined },
    };
    sendClientMessage(msg);
    setStatus('Verbunden. Authentifiziere...');
  });

  socket.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(event.data as string) as ServerMessage;
      handleServerMessage(parsed);
    } catch (err) {
      console.error('Invalid message', err);
    }
  });

  socket.addEventListener('close', () => {
    setStatus('Verbindung geschlossen.');
    btnStart.disabled = true;
    btnAttack.disabled = true;
    btnItem.disabled = true;
    socket = null;
    currentMatchId = null;
  });

  socket.addEventListener('error', () => {
    setStatus('WebSocket-Fehler.');
  });
}

function sendClientMessage(message: ClientMessage): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    setStatus('Nicht verbunden.');
    return;
  }

  socket.send(JSON.stringify(message));
}

btnConnect.addEventListener('click', () => {
  connect();
});

btnStart.addEventListener('click', () => {
  const playerSpeciesId = selectSpecies.value || 'sunflower';
  const msg: ClientMessage = {
    id: `cli_${Date.now().toString(36)}_${(++outSeq).toString(36)}`,
    seq: outSeq,
    ts: new Date().toISOString(),
    type: 'match/queue',
    payload: { mode: 'PVE_BOT', speciesId: playerSpeciesId, difficulty: 'easy' },
  };
  sendClientMessage(msg);
  btnAttack.disabled = false;
  btnItem.disabled = !selectItem.value;
});

btnAttack.addEventListener('click', () => {
  if (!currentMatchId) {
    setStatus('Kein aktives Match.');
    return;
  }
  const msg: ClientMessage = {
    id: `cli_${Date.now().toString(36)}_${(++outSeq).toString(36)}`,
    seq: outSeq,
    ts: new Date().toISOString(),
    type: 'match/command',
    payload: { matchId: currentMatchId, command: { type: 'ATTACK', targetIndex: 1 } },
  };
  sendClientMessage(msg);
});

btnItem.addEventListener('click', () => {
  const itemId = selectItem.value;
  if (!itemId) {
    setStatus('Bitte zuerst ein Item auswählen.');
    return;
  }
  if (!currentMatchId) {
    setStatus('Kein aktives Match.');
    return;
  }

  const msg: ClientMessage = {
    id: `cli_${Date.now().toString(36)}_${(++outSeq).toString(36)}`,
    seq: outSeq,
    ts: new Date().toISOString(),
    type: 'match/command',
    payload: {
      matchId: currentMatchId,
      command: { type: 'ITEM', targetIndex: 0, itemId },
    },
  };
  sendClientMessage(msg);
});

selectItem.addEventListener('change', () => {
  const canAct = !!lastMatchState && !lastMatchState.isFinished;
  btnItem.disabled = !canAct || !selectItem.value;
});

// Auto-connect in dev environments to reduce clicks.
connect();
