import { AStar, AStarResult, PathFindResultType } from "./AStar";
import { GameMap, TileRef } from "../game/GameMap";
import { DistanceBasedBezierCurve } from "../utilities/Line";
import { Game } from "../game/Game";
import { MiniAStar } from "./MiniAStar";
import { PseudoRandom } from "../PseudoRandom";

const parabolaMinHeight = 50;

export class ParabolaPathFinder {
  constructor(private readonly mg: GameMap) {}
  private curve: DistanceBasedBezierCurve | undefined;

  computeControlPoints(
    orig: TileRef,
    dst: TileRef,
    increment = 3,
    distanceBasedHeight = true,
  ) {
    const p0 = { x: this.mg.x(orig), y: this.mg.y(orig) };
    const p3 = { x: this.mg.x(dst), y: this.mg.y(dst) };
    const dx = p3.x - p0.x;
    const dy = p3.y - p0.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxHeight = distanceBasedHeight
      ? Math.max(distance / 3, parabolaMinHeight)
      : 0;
    // Use a bezier curve always pointing up
    const p1 = {
      x: p0.x + (p3.x - p0.x) / 4,
      y: Math.max(p0.y + (p3.y - p0.y) / 4 - maxHeight, 0),
    };
    const p2 = {
      x: p0.x + ((p3.x - p0.x) * 3) / 4,
      y: Math.max(p0.y + ((p3.y - p0.y) * 3) / 4 - maxHeight, 0),
    };

    this.curve = new DistanceBasedBezierCurve(p0, p1, p2, p3, increment);
  }

  nextTile(speed: number): TileRef | true {
    if (!this.curve) {
      throw new Error("ParabolaPathFinder not initialized");
    }
    const nextPoint = this.curve.increment(speed);
    if (!nextPoint) {
      return true;
    }
    return this.mg.ref(Math.floor(nextPoint.x), Math.floor(nextPoint.y));
  }

  currentIndex(): number {
    if (!this.curve) {
      return 0;
    }
    return this.curve.getCurrentIndex();
  }

  allTiles(): TileRef[] {
    if (!this.curve) {
      return [];
    }
    return this.curve
      .getAllPoints()
      .map((point) => this.mg.ref(Math.floor(point.x), Math.floor(point.y)));
  }
}

export class AirPathFinder {
  constructor(
    private readonly mg: GameMap,
    private readonly random: PseudoRandom,
  ) {}

  nextTile(tile: TileRef, dst: TileRef): TileRef | true {
    const x = this.mg.x(tile);
    const y = this.mg.y(tile);
    const dstX = this.mg.x(dst);
    const dstY = this.mg.y(dst);

    if (x === dstX && y === dstY) {
      return true;
    }

    // Calculate next position
    let nextX = x;
    let nextY = y;

    const ratio = Math.floor(1 + Math.abs(dstY - y) / (Math.abs(dstX - x) + 1));

    if (this.random.chance(ratio) && x !== dstX) {
      if (x < dstX) nextX++;
      else if (x > dstX) nextX--;
    } else {
      if (y < dstY) nextY++;
      else if (y > dstY) nextY--;
    }
    if (nextX === x && nextY === y) {
      return true;
    }
    return this.mg.ref(nextX, nextY);
  }
}

export class PathFinder {
  private curr: TileRef | null = null;
  private dst: TileRef | null = null;
  private path: TileRef[] | null = null;
  private aStar: AStar<TileRef>;
  private computeFinished = true;

  private constructor(
    private readonly game: Game,
    private readonly newAStar: (curr: TileRef, dst: TileRef) => AStar<TileRef>,
  ) {}

  public static Mini(
    game: Game,
    iterations: number,
    waterPath = true,
    maxTries = 20,
  ) {
    return new PathFinder(game, (curr: TileRef, dst: TileRef) => {
      return new MiniAStar(
        game.map(),
        game.miniMap(),
        curr,
        dst,
        iterations,
        maxTries,
        waterPath,
      );
    });
  }

  nextTile(
    curr: TileRef | null,
    dst: TileRef | null,
    dist = 1,
  ): AStarResult<TileRef> {
    if (curr === null) {
      console.error("curr is null");
      return { type: PathFindResultType.PathNotFound };
    }
    if (dst === null) {
      console.error("dst is null");
      return { type: PathFindResultType.PathNotFound };
    }

    if (this.game.manhattanDist(curr, dst) < dist) {
      // eslint-disable-next-line sort-keys
      return { type: PathFindResultType.Completed, node: curr };
    }

    if (this.computeFinished) {
      if (this.shouldRecompute(curr, dst)) {
        this.curr = curr;
        this.dst = dst;
        this.path = null;
        this.aStar = this.newAStar(curr, dst);
        this.computeFinished = false;
        return this.nextTile(curr, dst);
      } else {
        const tile = this.path?.shift();
        if (tile === undefined) {
          throw new Error("missing tile");
        }
        // eslint-disable-next-line sort-keys
        return { type: PathFindResultType.NextTile, node: tile };
      }
    }

    switch (this.aStar.compute()) {
      case PathFindResultType.Completed:
        this.computeFinished = true;
        this.path = this.aStar.reconstructPath();
        // Remove the start tile
        this.path.shift();

        return this.nextTile(curr, dst);
      case PathFindResultType.Pending:
        return { type: PathFindResultType.Pending };
      case PathFindResultType.PathNotFound:
        return { type: PathFindResultType.PathNotFound };
      default:
        throw new Error("unexpected compute result");
    }
  }

  private shouldRecompute(curr: TileRef, dst: TileRef) {
    if (this.path === null || this.curr === null || this.dst === null) {
      return true;
    }
    const dist = this.game.manhattanDist(curr, dst);
    let tolerance = 10;
    if (dist > 50) {
      tolerance = 10;
    } else if (dist > 25) {
      tolerance = 5;
    } else {
      tolerance = 0;
    }
    if (this.game.manhattanDist(this.dst, dst) > tolerance) {
      return true;
    }
    return false;
  }
}
