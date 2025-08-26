import {
  Execution,
  Game,
  Gold,
  Player,
  Tick,
  Unit,
  UnitType,
} from "../game/Game";
import { CityExecution } from "./CityExecution";
import { DefensePostExecution } from "./DefensePostExecution";
import { FactoryExecution } from "./FactoryExecution";
import { MirvExecution } from "./MIRVExecution";
import { MissileSiloExecution } from "./MissileSiloExecution";
import { NukeExecution } from "./NukeExecution";
import { PortExecution } from "./PortExecution";
import { SAMLauncherExecution } from "./SAMLauncherExecution";
import { TileRef } from "../game/GameMap";
import { WarshipExecution } from "./WarshipExecution";

export class ConstructionExecution implements Execution {
  private construction: Unit | null = null;
  private active = true;
  private mg: Game;

  private ticksUntilComplete: Tick;

  private cost: Gold;

  constructor(
    private player: Player,
    private readonly constructionType: UnitType,
    private readonly tile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;

    if (this.mg.config().isUnitDisabled(this.constructionType)) {
      console.warn(
        `cannot build construction ${this.constructionType} because it is disabled`,
      );
      this.active = false;
      return;
    }

    if (!this.mg.isValidRef(this.tile)) {
      console.warn(`cannot build construction invalid tile ${this.tile}`);
      this.active = false;
      return;
    }
  }

  tick(ticks: number): void {
    if (this.construction === null) {
      const info = this.mg.unitInfo(this.constructionType);
      if (info.constructionDuration === undefined) {
        this.completeConstruction();
        this.active = false;
        return;
      }
      const spawnTile = this.player.canBuild(this.constructionType, this.tile);
      if (spawnTile === false) {
        console.warn(`cannot build ${this.constructionType}`);
        this.active = false;
        return;
      }
      this.construction = this.player.buildUnit(
        UnitType.Construction,
        spawnTile,
        {},
      );
      this.cost = this.mg.unitInfo(this.constructionType).cost(this.player);
      this.player.removeGold(this.cost);
      this.construction.setConstructionType(this.constructionType);
      this.ticksUntilComplete = info.constructionDuration;
      return;
    }

    if (!this.construction.isActive()) {
      this.active = false;
      return;
    }

    if (this.player !== this.construction.owner()) {
      this.player = this.construction.owner();
    }

    if (this.ticksUntilComplete === 0) {
      this.player = this.construction.owner();
      this.construction.delete(false);
      // refund the cost so player has the gold to build the unit
      this.player.addGold(this.cost);
      this.completeConstruction();
      this.active = false;
      return;
    }
    this.ticksUntilComplete--;
  }

  private completeConstruction() {
    const { player } = this;
    switch (this.constructionType) {
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
        this.mg.addExecution(
          new NukeExecution(this.constructionType, player, this.tile),
        );
        break;
      case UnitType.MIRV:
        this.mg.addExecution(new MirvExecution(player, this.tile));
        break;
      case UnitType.Warship:
        this.mg.addExecution(
          new WarshipExecution({ owner: player, patrolTile: this.tile }),
        );
        break;
      case UnitType.Port:
        this.mg.addExecution(new PortExecution(player, this.tile));
        break;
      case UnitType.MissileSilo:
        this.mg.addExecution(new MissileSiloExecution(player, this.tile));
        break;
      case UnitType.DefensePost:
        this.mg.addExecution(new DefensePostExecution(player, this.tile));
        break;
      case UnitType.SAMLauncher:
        this.mg.addExecution(new SAMLauncherExecution(player, this.tile));
        break;
      case UnitType.City:
        this.mg.addExecution(new CityExecution(player, this.tile));
        break;
      case UnitType.Factory:
        this.mg.addExecution(new FactoryExecution(player, this.tile));
        break;
      default:
        console.warn(
          `unit type ${this.constructionType} cannot be constructed`,
        );
        break;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
