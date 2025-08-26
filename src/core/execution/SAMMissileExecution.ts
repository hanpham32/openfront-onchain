import {
  Execution,
  Game,
  MessageType,
  Player,
  Unit,
  UnitType,
} from "../game/Game";
import { AirPathFinder } from "../pathfinding/PathFinding";
import { NukeType } from "../StatsSchemas";
import { PseudoRandom } from "../PseudoRandom";
import { TileRef } from "../game/GameMap";

export class SAMMissileExecution implements Execution {
  private active = true;
  private pathFinder: AirPathFinder;
  private SAMMissile: Unit | undefined;
  private mg: Game;
  private speed = 0;

  constructor(
    private readonly spawn: TileRef,
    private readonly _owner: Player,
    private readonly ownerUnit: Unit,
    private readonly target: Unit,
    private readonly targetTile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.pathFinder = new AirPathFinder(mg, new PseudoRandom(mg.ticks()));
    this.mg = mg;
    this.speed = this.mg.config().defaultSamMissileSpeed();
  }

  tick(ticks: number): void {
    this.SAMMissile ??= this._owner.buildUnit(
      UnitType.SAMMissile,
      this.spawn,
      {},
    );
    if (!this.SAMMissile.isActive()) {
      this.active = false;
      return;
    }
    // Mirv warheads are too fast, and mirv shouldn't be stopped ever
    const nukesWhitelist = [UnitType.AtomBomb, UnitType.HydrogenBomb];
    if (
      !this.target.isActive() ||
      !this.ownerUnit.isActive() ||
      this.target.owner() === this.SAMMissile.owner() ||
      !nukesWhitelist.includes(this.target.type())
    ) {
      this.SAMMissile.delete(false);
      this.active = false;
      return;
    }
    for (let i = 0; i < this.speed; i++) {
      const result = this.pathFinder.nextTile(
        this.SAMMissile.tile(),
        this.targetTile,
      );
      if (result === true) {
        this.mg.displayMessage(
          `Missile intercepted ${this.target.type()}`,
          MessageType.SAM_HIT,
          this._owner.id(),
        );
        this.active = false;
        this.target.delete(true, this._owner);
        this.SAMMissile.delete(false);

        // Record stats
        this.mg
          .stats()
          .bombIntercept(this._owner, this.target.type() as NukeType, 1);
        return;
      } else {
        this.SAMMissile.move(result);
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }
  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
