from __future__ import annotations

import random
import time

from app.optimizer.construction import construct, pick_seeds
from app.optimizer.local_search import local_search
from app.optimizer.problem import Problem


def optimize(problem: Problem, log=print):
    cfg = problem.cfg
    rng = random.Random(cfg.seed)

    active = [x for x in range(problem.n) if problem.reachable(x)]
    unreachable = [x for x in range(problem.n) if x not in active]

    if not active:
        return [[problem.W] for _ in range(cfg.n_vehicles)], [], unreachable

    started = time.time()
    best = None

    for iteration in range(cfg.restarts):
        if time.time() - started > cfg.time_limit_s:
            break

        seeds = pick_seeds(
            problem,
            active,
            rng,
            greedy=(iteration == 0),
        )

        routes, uncovered = construct(
            problem,
            active,
            seeds,
        )

        routes = local_search(
            problem,
            routes,
            started + cfg.time_limit_s,
        )

        key = (
            len(uncovered),
            problem.objective([
                problem.rcost(route)
                for route in routes
            ]),
        )

        if best is None or key < best[0]:
            best = (
                key,
                [route[:] for route in routes],
                uncovered[:],
            )
            log(
                "restart %d: uncovered=%d objective=%.0f",
                iteration,
                key[0],
                key[1],
            )

    if best is None:
        return [[problem.W] for _ in range(cfg.n_vehicles)], active, unreachable

    return best[1], best[2], unreachable


def solve(
    stores,
    warehouse,
    config,
    provider,
    log=print,
):
    points = [(store.lat, store.lon) for store in stores]
    points.append(warehouse)

    distance, duration = provider.matrices(points)
    problem = Problem(
        stores,
        warehouse,
        config,
        distance,
        duration,
    )

    routes, uncovered, unreachable = optimize(problem, log=log)

    return problem, routes, uncovered, unreachable
