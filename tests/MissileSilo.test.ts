import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { constructionExecution, executeTicks } from "./util/utils";
import { NukeExecution } from "../src/core/execution/NukeExecution";
import { SpawnExecution } from "../src/core/execution/SpawnExecution";
import { TileRef } from "../src/core/game/GameMap";
import { UpgradeStructureExecution } from "../src/core/execution/UpgradeStructureExecution";
import { setup } from "./util/Setup";

let game: Game;
let attacker: Player;

function attackerBuildsNuke(
  source: TileRef | null,
  target: TileRef,
  initialize = true,
) {
  game.addExecution(
    new NukeExecution(UnitType.AtomBomb, attacker, target, source),
  );
  if (initialize) {
    game.executeNextTick();
    game.executeNextTick();
  }
}

describe("MissileSilo", () => {
  beforeEach(async () => {
    game = await setup("plains", { infiniteGold: true, instantBuild: true });
    const attacker_info = new PlayerInfo(
      "attacker_id",
      PlayerType.Human,
      null,
      "attacker_id",
    );
    game.addPlayer(attacker_info);

    game.addExecution(
      new SpawnExecution(game.player(attacker_info.id).info(), game.ref(1, 1)),
    );

    while (game.inSpawnPhase()) {
      game.executeNextTick();
    }

    attacker = game.player("attacker_id");

    constructionExecution(game, attacker, 1, 1, UnitType.MissileSilo);
  });

  test("missilesilo should launch nuke", async () => {
    attackerBuildsNuke(null, game.ref(7, 7));
    expect(attacker.units(UnitType.AtomBomb)).toHaveLength(1);
    expect(attacker.units(UnitType.AtomBomb)[0].tile()).not.toBe(
      game.map().ref(7, 7),
    );

    for (let i = 0; i < 5; i++) {
      game.executeNextTick();
    }
    expect(attacker.units(UnitType.AtomBomb)).toHaveLength(0);
  });

  test("missilesilo should only launch one nuke at a time", async () => {
    attackerBuildsNuke(null, game.ref(7, 7));
    attackerBuildsNuke(null, game.ref(7, 7));
    expect(attacker.units(UnitType.AtomBomb)).toHaveLength(1);
  });

  test("missilesilo should cooldown as long as configured", async () => {
    expect(attacker.units(UnitType.MissileSilo)[0].isInCooldown()).toBeFalsy();
    // send the nuke far enough away so it doesnt destroy the silo
    attackerBuildsNuke(null, game.ref(50, 50));
    expect(attacker.units(UnitType.AtomBomb)).toHaveLength(1);

    for (let i = 0; i < game.config().SiloCooldown() - 2; i++) {
      game.executeNextTick();
      expect(
        attacker.units(UnitType.MissileSilo)[0].isInCooldown(),
      ).toBeTruthy();
    }

    executeTicks(game, 2);

    expect(attacker.units(UnitType.MissileSilo)[0].isInCooldown()).toBeFalsy();
  });

  test("missilesilo should have increased level after upgrade", async () => {
    expect(attacker.units(UnitType.MissileSilo)[0].level()).toBe(1);

    const upgradeStructureExecution = new UpgradeStructureExecution(
      attacker,
      attacker.units(UnitType.MissileSilo)[0].id(),
    );
    game.addExecution(upgradeStructureExecution);
    executeTicks(game, 2);

    expect(attacker.units(UnitType.MissileSilo)[0].level()).toBe(2);
  });
});
