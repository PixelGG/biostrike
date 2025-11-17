# BioStrike

**BioStrike** ist ein server -autoritäres, rundenbasiertes Taktikspiel im Cartoon -Look, in dem Wetter und Ökologie spielentscheidend sind. Du stellst ein Team aus pflanzenartigen Kreaturen (Florans) zusammen, entscheidest über Aktionen wie Angriff, Fähigkeiten, Items oder Wechsel und kämpfst in Matches gegen andere Spieler oder die KI. Sieg und Niederlage hängen nicht nur von klassischen Lebenspunkten ab, sondern von deinem Verständnis für Wasserhaushalt, Photosynthese und Zustände wie Übernässe (Wurzelrot) oder Verdursten.

## Vision und Kernmechaniken

- **Ökologie als Kernmechanik:** Wetter -Parameter wie Hitze, Kälte, Trockenheit, Nässe, Wind und Bewölkung beeinflussen Transpiration, Regenaufnahme und Photosynthese jeder Floran. Zu wenig Wasser führt zum Verdursten, zu viel Wasser zu Wurzelrot.
- **Lesbare Tiefe:** Wenige klare Werte (HP, Kapazität, aktuelles Wasser, Oberfläche, Initiative, Offense/Defense, Resistenzen) und transparente Logeinträge erleichtern das Verständnis der Kampfmechanik.
- **Fair & transparent:** Keine Pay -to -Win -Mechaniken – wirtschaftliche Elemente wie Markt und Währung dienen Komfort und Sammeln, nicht der Kampfleistung.
- **Server -autoritätive Logik:** Alle wesentlichen Entscheidungen werden auf dem Server simuliert, deterministische Seeds erlauben Replays und Debugging.

## Projektstruktur

```
biostrike/
  client/        # TypeScript -Client (Canvas/WebGL), UI, Audio
    src/
      main.ts    # Einstiegspunkt für den Client
    package.json # Abhängigkeiten & Skripte
  server/        # Node.js -Server mit WebSockets und REST
    src/
      index.ts   # Einstiegspunkt für den Server
    package.json # Abhängigkeiten & Skripte
    tsconfig.json
  docs/          # Dokumentation (GDD, Tech -Design, API -Specs)
    game_design.md
    tech_design.md
  tools/         # Hilfsskripte z. B. für Daten -Export oder Balancing
  LICENSE        # Lizenz (MIT)
  README.md      # Dieses Dokument
```

## Erste Schritte

1. **Voraussetzungen:** Node.js (≥ 18) und npm. Für den Client wird ein moderner Browser benötigt. Optional kannst du den Client später mit Electron/Tauri als Desktop -App verpacken.
2. **Installieren:**

   ```bash
   cd biostrike/server && npm install
   cd ../client && npm install
   ```
3. **Starten des Servers:**

   ```bash
   cd biostrike/server
   npm run dev
   ```

   Der Server startet auf Port 3000 und bietet eine `/api/health` -Route sowie einen WebSocket -Endpunkt.

4. **Starten des Clients:**

   ```bash
   cd biostrike/client
   npm run start
   ```

   Aktuell ist dies nur ein Platzhalter, der später die grafische Benutzeroberfläche zeichnet.

## Mitwirken

Dieses Projekt steht noch am Anfang. Im Ordner `docs/` findest du das Game -Design -Dokument (`game_design.md`) und die technische Spezifikation (`tech_design.md`). Bitte lies beide, bevor du Beiträge einreichst. Ein Beitrag sollte stets einen Pull Request mit Beschreibung beinhalten. Tests und Lints folgen noch.

## Lizenz

Dieses Projekt steht unter der [MIT -Lizenz](LICENSE). Du bist eingeladen, es zu nutzen, zu verändern und zu verteilen, solange die Bedingungen der Lizenz eingehalten werden.
