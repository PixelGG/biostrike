import {
  Command,
  CommandType,
  Floran,
  KOReason,
  MatchLogEntry,
  MatchPhase,
  MatchView,
  MatchViewFloran,
  StatusType,
  WeatherType,
} from './types';

type RNG = () => number;

function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN_OVERFLOW_THRESHOLD = 1; // minimal overflow to count as overwatering

export class Match {
  private phase: MatchPhase;
  private round: number;
  private florans: [Floran, Floran];
  private logs: MatchLogEntry[];
  private weather: WeatherType;
  private rng: RNG;
  private isFinished: boolean;
  private winnerIndex: 0 | 1 | null;
  private koReason: KOReason | undefined;

  constructor(player: Floran, enemy: Floran, seed: number = Date.now()) {
    this.round = 0;
    this.phase = MatchPhase.StartOfRound;
    this.florans = [player, enemy];
    this.logs = [];
    this.weather = WeatherType.HotDry;
    this.rng = mulberry32(seed);
    this.isFinished = false;
    this.winnerIndex = null;
    this.koReason = undefined;
  }

  public nextRound(commands: [Command, Command]): void {
    if (this.isFinished) {
      return;
    }

    this.round++;
    this.phase = MatchPhase.StartOfRound;
    this.log(`Round ${this.round} starts`, {});

    this.updateWeather();
    this.applyEnvironment();
    this.applyPassiveStatus();

    this.phase = MatchPhase.CommandPhase;
    this.resolutionPhase(commands);

    this.phase = MatchPhase.EndOfRound;
    this.checkKO();
  }

  private updateWeather(): void {
    // Simple weighted rotation for the vertical slice.
    const roll = this.rng();
    if (roll < 0.25) {
      this.weather = WeatherType.HotDry;
    } else if (roll < 0.45) {
      this.weather = WeatherType.CoolDry;
    } else if (roll < 0.65) {
      this.weather = WeatherType.LightRain;
    } else if (roll < 0.8) {
      this.weather = WeatherType.HeavyRain;
    } else if (roll < 0.9) {
      this.weather = WeatherType.Cloudy;
    } else {
      this.weather = WeatherType.Windy;
    }

    this.log('Weather update', { weather: this.weather });
  }

  private applyEnvironment(): void {
    this.phase = MatchPhase.ApplyEnvironment;

    this.florans.forEach((floran) => {
      const baseTranspiration = 6;
      const heatModifier =
        this.weather === WeatherType.HotDry ? 4 : this.weather === WeatherType.CoolDry ? 1 : 0;
      const windModifier = this.weather === WeatherType.Windy ? 3 : 0;

      const resistanceReduction =
        (floran.stats.resistances.heat + floran.stats.resistances.dry) * 4;

      const transpirationRaw =
        baseTranspiration +
        heatModifier +
        windModifier -
        resistanceReduction;

      const transpiration = Math.max(0, Math.round(transpirationRaw));
      const beforeWater = floran.stats.currentWater;
      floran.stats.currentWater = Math.max(0, floran.stats.currentWater - transpiration);

      this.log('Transpiration', {
        floran: floran.name,
        baseTranspiration,
        heatModifier,
        windModifier,
        resistanceReduction,
        transpiration,
        beforeWater,
        afterWater: floran.stats.currentWater,
      });

      // Rain only applies if current weather is rainy
      if (
        this.weather === WeatherType.LightRain ||
        this.weather === WeatherType.HeavyRain
      ) {
        this.applyRain(floran);
      }
    });
  }

  private applyRain(floran: Floran): void {
    const capacity = floran.stats.capacity;
    const wetResist = floran.stats.resistances.wet;

    const [minPct, maxPct] =
      this.weather === WeatherType.LightRain ? [0.1, 0.25] : [0.3, 0.6];

    const roll = minPct + (maxPct - minPct) * this.rng();
    let regenGain = capacity * roll;
    regenGain *= 1 - wetResist;

    const beforeWater = floran.stats.currentWater;

    if (beforeWater + regenGain > capacity) {
      const overflow = beforeWater + regenGain - capacity;
      floran.stats.currentWater = capacity;

      this.log('Rain-Overflow', {
        floran: floran.name,
        regenGain,
        overflow,
      });

      if (overflow > MIN_OVERFLOW_THRESHOLD) {
        floran.overWaterStacks += 1;

        if (floran.overWaterStacks === 2 && !floran.rootRot) {
          floran.rootRot = true;
          floran.statuses.push({
            type: StatusType.RootRot,
            duration: 999,
            stacks: 1,
          });

          this.log('RootRot-Acquired', {
            floran: floran.name,
            overWaterStacks: floran.overWaterStacks,
          });
        }
      }
    } else {
      floran.stats.currentWater = beforeWater + regenGain;
    }

    this.log('Rain-Gain', {
      floran: floran.name,
      regenGain,
      beforeWater,
      afterWater: floran.stats.currentWater,
      wetResist,
    });
  }

  private applyPassiveStatus(): void {
    this.phase = MatchPhase.ApplyPassiveStatus;

    this.florans.forEach((floran) => {
      const remainingStatuses = [];

      for (const status of floran.statuses) {
        if (status.duration <= 0) {
          continue;
        }

        if (status.type === StatusType.RootRot) {
          const damage = Math.max(1, Math.round(floran.stats.maxHp * 0.12));
          const beforeHp = floran.stats.hp;
          floran.stats.hp = Math.max(0, floran.stats.hp - damage);

          this.log('RootRot-DOT', {
            floran: floran.name,
            damage,
            beforeHp,
            afterHp: floran.stats.hp,
          });
        }

        status.duration -= 1;
        if (status.duration > 0) {
          remainingStatuses.push(status);
        }
      }

      floran.statuses = remainingStatuses;
    });
  }

  private resolutionPhase(commands: [Command, Command]): void {
    this.phase = MatchPhase.ResolutionPhase;

    const order = [0, 1].sort(
      (a, b) => this.florans[b].stats.initiative - this.florans[a].stats.initiative,
    );

    for (const actingIndex of order) {
      if (this.isFinished) {
        break;
      }

      const cmd = commands[actingIndex];
      const floran = this.florans[actingIndex];
      const targetIndex = cmd.targetIndex ?? (actingIndex === 0 ? 1 : 0);
      const target = this.florans[targetIndex];

      if (floran.stats.hp <= 0) {
        continue;
      }

      if (cmd.type === CommandType.Attack) {
        this.resolveBasicAttack(floran, target);
      }

      // Other command types (Skill, Item, Switch) can be implemented later.
    }
  }

  private resolveBasicAttack(attacker: Floran, defender: Floran): void {
    const surface = attacker.stats.surface;
    const waterRatio =
      attacker.stats.capacity > 0
        ? attacker.stats.currentWater / attacker.stats.capacity
        : 0;

    let psBase = 6;
    let sunFactor = 1;

    if (waterRatio > 0.25) {
      switch (this.weather) {
        case WeatherType.HotDry:
          sunFactor = 1.3;
          break;
        case WeatherType.CoolDry:
          sunFactor = 1.0;
          break;
        case WeatherType.Cloudy:
          sunFactor = 0.7;
          break;
        case WeatherType.LightRain:
        case WeatherType.HeavyRain:
          sunFactor = 0.3;
          break;
        default:
          sunFactor = 1.0;
          break;
      }
    } else {
      psBase = 0;
      sunFactor = 0;
    }

    const ps = psBase * sunFactor * surface;
    const skillCoefficient = 0.5;
    const offBonus = ps * skillCoefficient;

    const rawOffense = attacker.stats.offense + offBonus;
    const skillMultiplier = 1.0;
    const rawDamage = rawOffense * skillMultiplier;
    const mitigation = defender.stats.defense * 0.5;
    const baseDamage = Math.max(1, rawDamage - mitigation);

    const weatherMod = 1.0;
    const resistanceMod = 1.0; // physical attacks ignore resistances in this slice

    const finalDamage = Math.max(1, Math.round(baseDamage * weatherMod * resistanceMod));

    const beforeHp = defender.stats.hp;
    defender.stats.hp = Math.max(0, defender.stats.hp - finalDamage);

    this.log('Attack', {
      attacker: attacker.name,
      defender: defender.name,
      ps,
      offBonus,
      rawOffense,
      mitigation,
      baseDamage,
      finalDamage,
      beforeHp,
      afterHp: defender.stats.hp,
    });
  }

  private checkKO(): void {
    const koFlags: boolean[] = [false, false];
    const koReasons: (KOReason | null)[] = [null, null];

    this.florans.forEach((floran, index) => {
      if (floran.stats.hp <= 0) {
        koFlags[index] = true;
        koReasons[index] = KOReason.Hp;
        this.log('KO', { floran: floran.name, reason: 'HP' });
        return;
      }

      if (floran.stats.currentWater <= 0) {
        koFlags[index] = true;
        koReasons[index] = KOReason.Dehydration;
        this.log('KO', { floran: floran.name, reason: 'Dehydration' });
        return;
      }

      if (floran.rootRot && floran.overWaterStacks >= 3) {
        koFlags[index] = true;
        koReasons[index] = KOReason.RootRot;
        this.log('KO', { floran: floran.name, reason: 'RootRot' });
      }
    });

    const aliveIndices = [0, 1].filter((i) => !koFlags[i]);

    if (aliveIndices.length === 1) {
      this.isFinished = true;
      this.winnerIndex = aliveIndices[0] as 0 | 1;
      const loserIndex = this.winnerIndex === 0 ? 1 : 0;
      this.koReason = koReasons[loserIndex] ?? undefined;

      this.log('Match-End', {
        winnerIndex: this.winnerIndex,
        koReason: this.koReason,
      });
    } else if (aliveIndices.length === 0) {
      this.isFinished = true;
      this.winnerIndex = null;
      this.koReason = KOReason.Hp;

      this.log('Match-End', {
        winnerIndex: this.winnerIndex,
        koReason: this.koReason,
      });
    }
  }

  public getState(): MatchView {
    const florans: [MatchViewFloran, MatchViewFloran] = this.florans.map((f) => ({
      id: f.id,
      name: f.name,
      hp: f.stats.hp,
      maxHp: f.stats.maxHp,
      currentWater: f.stats.currentWater,
      capacity: f.stats.capacity,
      surface: f.stats.surface,
      initiative: f.stats.initiative,
      offense: f.stats.offense,
      defense: f.stats.defense,
      resistances: f.stats.resistances,
      overWaterStacks: f.overWaterStacks,
      rootRot: f.rootRot,
      statuses: f.statuses,
    })) as [MatchViewFloran, MatchViewFloran];

    return {
      round: this.round,
      phase: this.phase,
      weather: this.weather,
      florans,
      logs: this.logs.slice(),
      isFinished: this.isFinished,
      winnerIndex: this.winnerIndex,
      koReason: this.koReason,
    };
  }

  private log(message: string, details: Record<string, unknown>): void {
    this.logs.push({
      round: this.round,
      phase: this.phase,
      message,
      details,
    });
  }
}
