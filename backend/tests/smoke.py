"""Smoke test: load map, run A*, CBS, a few game turns."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.game.grid import load_default_map
from app.game.state import GameState
from app.ai.astar import astar
from app.ai.cbs import cbs


def main():
    gmap = load_default_map()
    print(f"Map {gmap.rows}x{gmap.cols}")
    print(f"Thief spawns: {gmap.thief_spawns}")
    print(f"Guard spawns: {gmap.guard_spawns}")
    print(f"Vault: {gmap.vault}  Exits: {gmap.exits}")
    print(f"Cameras: {len(gmap.cameras)}  Sensors: {len(gmap.sensors)}")
    for row in gmap.tiles:
        print("".join(row))

    # A* test
    res = astar(gmap, gmap.thief_spawns[0], gmap.vault)
    assert res is not None, "A* failed to find path to vault"
    print(f"\nA* to vault: path len={len(res.path)}, expanded={len(res.expanded)}")

    # CBS test — use distinct goals (vault + two exits)
    starts = {i: s for i, s in enumerate(gmap.thief_spawns)}
    targets = [gmap.vault] + gmap.exits
    goals = {i: targets[i % len(targets)] for i in range(len(gmap.thief_spawns))}
    cres = cbs(gmap, starts, goals)
    assert cres is not None, "CBS failed"
    print(f"CBS paths: {[(k, len(v)) for k,v in cres.paths.items()]}  conflicts={len(cres.conflicts)}  nodes={cres.expanded_nodes}")

    # Game simulation
    st = GameState.new(gmap, mode="ai_vs_ai")
    st.auto_plan_thieves()
    st.phase = st.phase.__class__.EXECUTION
    for i in range(30):
        log = st.advance_turn()
        if st.phase.value == "finished":
            print(f"\nGame over at turn {st.turn}, winner={st.winner.value}")
            break
        # maybe replan
        needs = any((not t.escaped and not t.caught and
                     (not t.path or t.path_index + 1 >= len(t.path)))
                    for t in st.thieves.values())
        if needs:
            st.auto_plan_thieves()
    else:
        print(f"\nSim ran {st.turn} turns; winner={st.winner.value}")


if __name__ == "__main__":
    main()
