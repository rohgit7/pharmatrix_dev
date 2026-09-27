from __future__ import annotations

import math
import random

from app.optimizer.problem import Problem, angdiff


def pick_seeds(
    problem: Problem,
    active: list[int],
    rng: random.Random,
    greedy: bool,
) -> dict[int, int]:
    """Pick at most one seed for each vehicle, respecting vehicle capacity."""
    remaining = set(active)
    seeds: dict[int, int] = {}

    for vehicle_index in range(problem.cfg.n_vehicles):
        capacity = problem.cfg.capacity_for_vehicle(vehicle_index)
        eligible = [x for x in remaining if problem.dem[x] <= capacity]
        if not eligible:
            continue

        max_dw = max(problem.dw[x] for x in eligible) or 1.0
        top = sorted(eligible, key=lambda x: -problem.dw[x])[:3]

        if greedy:
            seed = top[0]
        else:
            seed = rng.choice(top)

        # Keep the seed-selection pressure toward farthest points,
        # while spacing seeds across distinct corridors.
        if seeds and len(top) > 1:
            def score(x: int) -> float:
                spacing = min(
                    (problem.D[x][y] + problem.D[y][x]) / 2
                    for y in seeds.values()
                )
                return spacing * (0.5 + 0.5 * problem.dw[x] / max_dw)

            candidates = sorted(top, key=score, reverse=True)
            if not greedy:
                seed = rng.choice(candidates)
            else:
                seed = candidates[0]

        seeds[vehicle_index] = seed
        remaining.remove(seed)

    return seeds


def construct(
    problem: Problem,
    active: list[int],
    seeds: dict[int, int],
):
    cfg = problem.cfg
    warehouse_index = problem.W
    routes = [[warehouse_index] for _ in range(cfg.n_vehicles)]

    for vehicle_index, seed in seeds.items():
        routes[vehicle_index] = [seed, warehouse_index]

    stats = [list(problem.stats(route)) for route in routes]
    sin_bearing = [
        sum(math.sin(problem.bear[x]) for x in route[:-1])
        for route in routes
    ]
    cos_bearing = [
        sum(math.cos(problem.bear[x]) for x in route[:-1])
        for route in routes
    ]
    unassigned = set(active) - set(seeds.values())

    while unassigned:
        best = None

        for store_index in unassigned:
            options = []

            for vehicle_index, route in enumerate(routes):
                distance, duration, demand = stats[vehicle_index]
                capacity = cfg.capacity_for_vehicle(vehicle_index)

                if demand + problem.dem[store_index] > capacity:
                    continue

                corridor_penalty = 0.0
                if len(route) > 1:
                    mean_bearing = math.atan2(
                        sin_bearing[vehicle_index],
                        cos_bearing[vehicle_index],
                    )
                    corridor_penalty = (
                        cfg.corridor
                        * problem.dw[store_index]
                        * angdiff(problem.bear[store_index], mean_bearing)
                        / math.pi
                    )

                best_insertion = None

                for position in range(len(route)):
                    b = route[position]
                    if position == 0:
                        delta_cost = problem.C[store_index][b]
                        delta_distance = problem.D[store_index][b]
                        delta_time = problem.T[store_index][b] + problem.svc[store_index]
                    else:
                        a = route[position - 1]
                        delta_cost = (
                            problem.C[a][store_index]
                            + problem.C[store_index][b]
                            - problem.C[a][b]
                        )
                        delta_distance = (
                            problem.D[a][store_index]
                            + problem.D[store_index][b]
                            - problem.D[a][b]
                        )
                        delta_time = (
                            problem.T[a][store_index]
                            + problem.T[store_index][b]
                            - problem.T[a][b]
                            + problem.svc[store_index]
                        )

                    if distance + delta_distance > cfg.max_dist_m:
                        continue
                    if duration + delta_time > cfg.max_time_s:
                        continue

                    candidate = (delta_cost, position)
                    if best_insertion is None or candidate[0] < best_insertion[0]:
                        best_insertion = candidate

                if best_insertion is not None:
                    options.append(
                        (
                            best_insertion[0] + corridor_penalty,
                            vehicle_index,
                            best_insertion[1],
                        )
                    )

            if not options:
                continue

            options.sort(key=lambda item: item[0])
            regret = options[1][0] - options[0][0] if len(options) > 1 else 1e12
            key = (regret, problem.val[store_index])

            if best is None or key > best[0]:
                best = (key, store_index, options[0])

        if best is None:
            break

        _, store_index, (_, vehicle_index, position) = best
        routes[vehicle_index].insert(position, store_index)
        stats[vehicle_index] = list(problem.stats(routes[vehicle_index]))
        sin_bearing[vehicle_index] += math.sin(problem.bear[store_index])
        cos_bearing[vehicle_index] += math.cos(problem.bear[store_index])
        unassigned.remove(store_index)

    return routes, sorted(unassigned)
