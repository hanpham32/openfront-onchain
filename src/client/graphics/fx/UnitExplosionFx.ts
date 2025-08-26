import { Fx, FxType } from "./Fx";
import { AnimatedSpriteLoader } from "../AnimatedSpriteLoader";
import { GameView } from "../../../core/game/GameView";
import { SpriteFx } from "./SpriteFx";
import { Timeline } from "./Timeline";

/**
 * Explosion Effect: a few timed explosions
 */
export class UnitExplosionFx implements Fx {
  private readonly timeline = new Timeline();
  private readonly explosions: Fx[] = [];

  constructor(
    animatedSpriteLoader: AnimatedSpriteLoader,
    private readonly x: number,
    private readonly y: number,
    game: GameView,
  ) {
    const config = [
      { dx: 0, dy: 0, delay: 0, type: FxType.UnitExplosion },
      { dx: 4, dy: -6, delay: 80, type: FxType.UnitExplosion },
      { dx: -6, dy: 4, delay: 160, type: FxType.UnitExplosion },
    ];
    for (const { dx, dy, delay, type } of config) {
      this.timeline.add(delay, () => {
        if (game.isValidCoord(x + dx, y + dy)) {
          this.explosions.push(
            new SpriteFx(animatedSpriteLoader, x + dx, y + dy, type),
          );
        }
      });
    }
  }

  renderTick(frameTime: number, ctx: CanvasRenderingContext2D): boolean {
    this.timeline.update(frameTime);
    let allDone = true;
    for (const fx of this.explosions) {
      if (fx.renderTick(frameTime, ctx)) {
        allDone = false;
      }
    }

    return !allDone || !this.timeline.isComplete();
  }
}
