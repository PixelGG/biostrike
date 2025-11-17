# Game Design Dokument – BioStrike

## 1. Produktvision und Design‑Pfeiler

**Elevator Pitch:** BioStrike ist ein rundenbasiertes Taktik‑Game im Cartoon‑Look, in dem Wetter und Ökologie spielentscheidend sind. Du formst ein Team aus pflanzenartigen Kreaturen (Florans) und kämpfst in 1v1‑Matches (später 3v3). Der Unterschied zu klassischen Taktikspielen liegt in der Wasserbilanz: Sieg und Niederlage hängen von Photosynthese, Transpiration und Zuständen wie Wurzelrot (Übernässe) oder Verdursten ab.

**Kern‑Fantasie:** _„Ich gewinne, weil ich Klima, Wasserhaushalt und ökologische Effekte besser verstehe – nicht, weil ich einfach höhere Zahlen habe.“_

### Design‑Pfeiler

1. **Ökologie als Kernmechanik:** Wetter‑Parameter wie Hitze, Kälte, Trockenheit, Nässe, Wind und Bewölkung beeinflussen jede Runde Transpiration und Regenaufnahme. Zwei KO‑Wege existieren: Verdursten (Wasser ≤ 0) und Wurzelrot (wiederholte Übernässe).
2. **Lesbare Tiefe:** Wenige klare Werte (HP, Kapazität, aktuelles Wasser, Oberfläche, Initiative, Offense/Defense, Resistenzen). Jede Wirkung wird transparent im Log angezeigt („Transpiration −16 = Basis 12 + Heiß 6 − Mulch 2“).
3. **Fair und transparent:** Kein Pay‑to‑Win. Markt und Währung dienen Komfort/Sammeln, nicht dem Kampf. Server‑autoritative Logik mit deterministischem Seed sorgt für Replays und Debugging.

## 2. Core Loop & Modi

**Core Loop:** Sammeln → Team bauen (Roster 6) → Match (1v1) → Belohnungen (XP/BC/Items/Fang) → Optimieren (Perks/Loadouts/Handel) → nächstes Match.

### Modi

- **PvE:** Begegnungen/Bosse, Fang & Drops, keine Elo.
- **Casual PvP:** Unranked, optionale Event‑Mutatoren.
- **Ranked PvP:** Elo/MMR, Wetter‑Ban pro Seite, Leaderboards.
- **Events:** Zeitlich begrenzte Boni (XP/BC), Klima‑Events (Monsun/Dürre/Sturm), Bannkern‑Jagd, Markt‑Gebührenferien, BC‑Boosts.

## 3. Kampfsystem & Ökologie

### 3.1 Rundenflow

Der Server verwaltet den gesamten Rundenablauf als endliche Zustandsmaschine (Enum `MatchPhase`).

1. **StartOfRound:** Runden‑Counter erhöhen; ggf. neues Wetter basierend auf Arena‑Gewichtungen.
2. **ApplyEnvironment:** Transpiration, Regenaufnahme und globale Wetter‑Effekte werden berechnet.
3. **ApplyPassiveStatus:** Dauer‑Effekte (DoTs wie Wurzelrot, Welken; Buffs/Debuffs) ticken.
4. **CommandPhase:** Beide Spieler wählen verdeckt eine Aktion (ATTACK / SKILL / ITEM / SWITCH).

Ein Wechsel senkt die Initiative dieser Runde.
5. **ResolutionPhase:** Aktionen werden nach Initiative abgearbeitet. Gleichstand → Seed‑basierter Tie‑Break.
6. **KO‑Phase:** KO bei HP ≤ 0, Wasser ≤ 0 oder Wurzelrot‑KO (erneute Übernässe).
7. **EndOfRound:** Rundenspezifische Effekte laufen aus; Log wird finalisiert; Seed für nächste Runde wird gesetzt.

### 3.2 Floran‑Attribute

Jede Floran‑Art besitzt folgende Basiswerte (Beispielbereiche):

| Wert             | Bereich (Beispiel) |
|------------------|--------------------|
| HP               | 80–160             |
| Wasser‑Kapazität | 30–70              |
| Oberfläche       | 0.8–1.6            |
| Initiative       | 50‑150             |
| Offense (OFF)    | 20‑60              |
| Defense (DEF)    | 10‑50              |
| Resistenzen (%)  | 0‑85 (Hitze, Kälte, Trocken, Nass, Wind, Salz) |

### 3.3 Transpiration und Regenaufnahme

**Transpiration:**

```
TranspirationRaw = BaseSpecies + HeatModifier + WindModifier - MulchBonus - LeafWaxBonus - ResistenzAnteile
Transpiration    = max(0, TranspirationRaw)
currentWater     = max(0, currentWater - Transpiration)
```

Keine negative Transpiration; eine Floran erhält kein „Gratis‑Wasser“.

**Regenaufnahme:**

```
regenGain = capacity * rand[0.10, 0.25]  # leichter Regen
regenGain = capacity * rand[0.30, 0.60]  # starker Regen
regenGain *= (1 - NassResist)
```

Bei Überlauf wird `currentWater` auf `capacity` gesetzt; Überschuss erzeugt Übernässe‑Stacks, die zu Wurzelrot führen können.

### 3.4 Status & KO

- **Übernässe & Wurzelrot:** Bei zwei Übernässe‑Stacks wird Wurzelrot aktiv (DoT 10‑15 % HP/Runde). Ein weiterer Überlauf führt zum sofortigen KO.
- **Verdursten:** Wenn `currentWater <= 0` am Ende der Runde, erleidet die Floran ein KO mit Grund „Verdursten“.
- **Photosynthese:** Nur wenn `currentWater/capacity > 0.25` und das Wetter Sonne ermöglicht. PS erzeugt temporären Offense‑Bonus.

### 3.5 Items, Status, Wetter

- **Items:** Mehrere Timing‑Kategorien (Pre‑Status, Instant, Pre‑Resolve, Passive). Beispiele: Mulch reduziert Transpiration; Gießkanne füllt Wasser; Pilzhemm‑Serum entfernt Wurzelrot.
- **Status:** DoTs (Welken, Wurzelrot), Buffs/Debuffs (Blattverlust, Resistenz‑Debuffs), Reactive (Dornen/Reflex). Jeder Status hat Dauer, Stacks und Quelle.
- **Wetter:** Heiß & trocken, kühl & trocken, leichter Regen, starker Regen, windig, bewölkt. Arena‑spezifische Gewichtungen bestimmen Wetterwechsel.

## 4. Content & Progression

- **Florans:** ~41 Arten mit klaren Rollen (Tank, Offensiv, Support, Control, DoT, Reflex). Einige besitzen Evolutionslinien (Seedling → Mature → Bloom).
- **Items:** Ca. 20 Items im MVP, jeweils mit Nutzen und Risiken. Uses per match, Stackability, Trade‑offs.
- **Progression:** Spieler‑Level 1–30 mit moderaten Stat‑Zuwächsen (~8–10 % Gesamt). Perks bei Lv 5/15/25, Skill‑Slots bei 10/20. Fangsystem (Bannkerne) ermöglicht das Fangen von Florans im PvE.

## 5. Ökonomie und Events

- **Währung:** Biocredits (BC). Einnahmen aus Matches, Quests und Events. Ausgaben für Shop‑Items, Marktgebühren, Respec, Kosmetik.
- **Markt:** Peer‑to‑peer‑Handel mit Gebühren (5‑10 %). Keine kampfrelevanten Stats zum Kauf.
- **Events:** Zeitlich begrenzte Klima‑ und Ökonomie‑Events (z. B. Monsun‑Woche → häufigere Regenwetter).

## 6. UI/UX

- **Darstellung:** 2D‑Sideview‑Kampfszene (später optional Grid), dunkles UI mit farbcodierten Akzenten pro Schadenstyp. Trennung von DOM (Home, Lobby, Team‑Builder, Inventar, Markt, Events, Logs) und Canvas/WebGL (Kampf‑Arena).
- **Battle‑HUD:** Zeigt Arena‑Name, aktuelles Wetter, Wetter‑Vorschau, Portraits/Sprites der Florans, HP‑ und Wasser‑Balken, Status‑Icons sowie ein Aktionsrad für Attack/Skill/Item/Switch. Log und Chat sind einklappbar.

## 7. Roadmap

1. **Vertical Slice:** 2‑3 Beispiel‑Florans, wenige Items und Wettertypen; vollständiger Rundenflow; einfache UI; server‑autoritative Simulation; PvE‑Begegnung oder 1v1 gegen Bot.
2. **Backend v0.1:** Auth‑Service, Match‑Service, Economy‑Service; WebSocket‑Protokoll; MongoDB‑Anbindung; einfache Admin‑Funktionen.
3. **MVP:** 41 Florans, 20 Items, Team‑Builder, Inventar, Markt, PvE‑Fangsystem, Casual und Ranked PvP, Event‑Rotation und grundlegende Ökonomie.
4. **Post‑MVP:** 3v3‑Modus, zusätzliche Arenen/Biome, Boss‑Fights, Replay‑Viewer, Zuschauer‑Modus, Kosmetiken und Evolutionen.

Das vorliegende Dokument beschreibt die Grundlagen. Weitere Details, Formeln und Balancing‑Tabellen werden iterativ ergänzt.
