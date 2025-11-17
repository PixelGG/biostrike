# Technische Spezifikation – BioStrike

Diese Spezifikation beschreibt die geplante Architektur und den Technologie‑Stack für BioStrike. Sie ist eine Arbeitsbasis und wird während der Entwicklung erweitert.

## 1. Technologieübersicht

- **Sprache:** TypeScript für Server und Client.
- **Server:** Node.js mit Express für REST‑Endpoints und `ws`‑Bibliothek für WebSocket‑Kommunikation.
- **Client:** TypeScript mit Canvas oder WebGL für die Kampfdarstellung (später ggf. PixiJS oder Phaser). UI‑Layer kann mit einem Framework wie React oder Svelte aufgebaut werden.
- **Datenbank:** MongoDB. Collections für Benutzer, Floran‑Instanzen, Inventare, Match‑Records, Replays, Market‑Listings, Events.
- **Build & Tools:** `ts-node` für lokale Entwicklung, `nodemon` zum automatischen Neustart, ESLint/Prettier (via CI, noch nicht konfiguriert), Unit‑Tests mit Jest oder Vitest (geplant).

## 2. Server‑Architektur

Der Server folgt einer service‑orientierten Struktur. Kernkomponenten sind:

### 2.1 Auth‑Service

Verwaltet Accounts, Sessions und Wiederherstellungs‑Keys. Aufruf via REST (`/api/auth/login`, `/api/auth/register`). Nach erfolgreicher Authentifizierung erhält der Client einen JWT‑Token.

### 2.2 Matchmaking‑Service

- Warteschlangen für Casual und Ranked.
- Elo/MMR‑Berechnung und Season‑Verwaltung.
- Auswahl des Wetters zum Bann (Ranked).

### 2.3 Match‑Service

- Erstellt Match‑Instanzen und verwaltet deren Lebenszyklus.
- Simuliert den Rundenflow server‑seitig (siehe GDD) und versendet Zustände/Logs via WebSocket.
- Speichert Seeds und Eingaben für Replays.
- Validiert Client‑Aktionen (Runde, Cooldown, Ressourcen, Zustände).

### 2.4 Economy‑Service

Verantwortlich für Biocredit‑Balance, Shop‑Käufe, Marktgebühren und Event‑Belohnungen. Bietet REST‑Endpunkte (`/api/shop`, `/api/market`, `/api/events`).

### 2.5 PvE‑Service

Definiert Encounter, Fang‑Logik und Drop‑Tabellen. Implementiert nur PvE‑Matches (keine Elo).

### 2.6 Chat‑Service

WebSocket‑basiert; unterstützt Lobby‑, Biom‑ und Match‑Chats; Moderationsfunktionen (Mute/Block/Report).

### 2.7 Data‑Modelle (Interfaces)

```ts
// Beispielhafte TypeScript‑Interfaces
export interface FloranSpecies {
  id: string;
  name: string;
  hp: number;
  capacity: number;
  surface: number;
  initiative: number;
  offense: number;
  defense: number;
  resistances: {
    heat: number;
    cold: number;
    dry: number;
    wet: number;
    wind: number;
    salt: number;
  };
  skills: string[]; // IDs der Fähigkeiten
}

export interface FloranInstance {
  id: string;
  speciesId: string;
  currentHp: number;
  currentWater: number;
  overwaterStacks: number;
  statuses: StatusInstance[];
  // ... weitere Felder
}

export interface MatchState {
  id: string;
  seed: number;
  phase: MatchPhase;
  round: number;
  players: MatchPlayer[];
  log: LogEntry[];
}
```

Diese Interfaces werden sowohl vom Server (für Serialisierung) als auch vom Client (für Typ‑Sicherheit) genutzt.

## 3. WebSocket‑Protokoll

Die Match‑Kommunikation läuft über WebSockets. Nachrichten bestehen aus einem `type`‑Feld und einem `payload`:

```json
{
  "type": "command",
  "payload": {
    "matchId": "abc123",
    "round": 5,
    "action": "ATTACK",
    "floranId": "f1",
    "skillId": "basic-attack",
    "targetId": "enemy1"
  }
}
```

Der Server antwortet mit `match_state`‑ oder `error`‑Nachrichten. Die Kommunikation ist deterministisch; der Client führt keine eigenständige Spielsimulation durch, sondern zeigt nur den vom Server erhaltenen Zustand an.

## 4. Client‑Architektur

Der Client besteht aus mehreren Schichten:

1. **Core:** Game‑Loop, Client‑State, Match‑Phasen‑Handling.
2. **Systems:** Kampfsystem, Ökologie‑Simulation (nur für Previews, nicht authoritative), Status‑Verwaltung, Item‑Effekte.
3. **Net:** WebSocket‑Client, Reconnect‑Logik, Messaging.
4. **UI:** Komponenten für Menüs, Panels, Battle‑HUD, Inventar, Markt usw. (Framework‑neutral; im MVP kann Vanilla JS oder Svelte genutzt werden).
5. **Data:** Statische Konfigurationen (Florans, Items, Arenen, Events); werden beim Start aus dem Server geladen und gecacht.

## 5. Continuous Integration (CI)

Für das Repository ist ein einfacher GitHub Actions‑Workflow vorgesehen (`.github/workflows/ci.yml`). Dieser führt Linting, Typprüfungen und Tests aus. Ein Beispiel:

```yaml
name: CI
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install dependencies
        run: |
          cd server && npm install
          cd ../client && npm install
      - name: Type check
        run: |
          cd server && npx tsc --noEmit
          cd ../client && npx tsc --noEmit
      # Tests können hier später ergänzt werden
```

Dieses Script ist ein Ausgangspunkt und kann erweitert werden (z. B. für Linting, Unit‑Tests oder Deploy‑Schritte).

## 6. Weiteres

- **Dokumentation:** Das GDD (`game_design.md`) bildet die Basis für die Spielinhalte. Technische Ergänzungen werden in diesem Dokument gepflegt.
- **Tools:** Im Ordner `tools/` können Scripts abgelegt werden, z. B. zur Generierung von Balancing‑Sheets (CSV/JSON) oder zur Analyse von Match‑Daten.

Diese Spezifikation skizziert den geplanten Aufbau von BioStrike. Sie wird während der Entwicklung iterativ angepasst, sobald neue Anforderungen auftreten oder Änderungen im Design erforderlich sind.
