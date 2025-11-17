import { MatchPhase, Floran } from './types';

export enum CommandType {
  Attack = 'ATTACK',
  Skill = 'SKILL',
  Item = 'ITEM',
  Switch = 'SWITCH',
}

export interface Command {
  type: CommandType;
  target?: number;
}

export class Match {
  private phase: MatchPhase;
  private round: number;
  private florans: [Floran, Floran];
  private logs: string[];

  constructor(player: Floran, enemy: Floran) {
    this.round = 0;
    this.phase = MatchPhase.StartOfRound;
    this.florans = [player, enemy];
    this.logs = [];
  }

  public nextRound(commands: [Command, Command]) {
    this.round++;
    this.phase = MatchPhase.StartOfRound;
    this.logs.push(`Round ${this.round} starts`);
    this.applyEnvironment();
    this.applyPassiveStatus();
    this.phase = MatchPhase.CommandPhase;
    this.resolutionPhase(commands);
    this.phase = MatchPhase.EndOfRound;
    this.checkKO();
  }

  private applyEnvironment() {
    this.phase = MatchPhase.ApplyEnvironment;
    this.florans.forEach(floran => {
      const transp = Math.min(5, floran.stats.currentWater);
      floran.stats.currentWater -= transp;
      this.logs.push(`${floran.name} transpires ${transp}`);
    });
  }

  private applyPassiveStatus() {
    this.phase = MatchPhase.ApplyPassiveStatus;
    this.florans.forEach(floran => {
      floran.statuses.forEach(status => {
        if (status.duration > 0) {
          // simple: root rot deals 10% max hp damage
          if ((status as any).type === 'RootRot') {
            const damage = Math.round(floran.stats.hp * 0.1);
            floran.stats.hp -= damage;
            this.logs.push(`${floran.name} suffers ${damage} damage from root rot`);
          }
          status.duration--;
        }
      });
      floran.statuses = floran.statuses.filter(s => s.duration > 0);
    });
  }

  private resolutionPhase(commands: [Command, Command]) {
    this.phase = MatchPhase.ResolutionPhase;
    const order = [0,1].sort((a,b) => this.florans[b].stats.initiative - this.florans[a].stats.initiative);
    order.forEach(i => {
      const cmd = commands[i];
      const floran = this.florans[i];
      const targetIndex = i === 0 ? 1 : 0;
      const target = this.florans[targetIndex];
      if (cmd.type === CommandType.Attack) {
        const raw = floran.stats.offense;
        const mitigation = target.stats.defense * 0.5;
        const damage = Math.max(1, Math.round(raw - mitigation));
        target.stats.hp -= damage;
        this.logs.push(`${floran.name} attacks ${target.name} for ${damage} damage`);
      }
      // other command types not implemented yet
    });
  }

  private checkKO() {
    this.florans.forEach(floran => {
      if (floran.stats.hp <= 0 || floran.stats.currentWater <= 0) {
        this.logs.push(`${floran.name} is knocked out`);
      }
    });
  }

  public getLogs(): string[] {
    return this.logs;
  }
}
