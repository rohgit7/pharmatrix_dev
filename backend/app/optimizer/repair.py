from __future__ import annotations

from app.optimizer.overlap import fleet_overlap, segments
from app.optimizer.problem import Problem


def _route_points(problem: Problem, route: list[int], warehouse: tuple[float, float]):
    return [
        (problem.st[x].lat, problem.st[x].lon)
        for x in route[:-1]
    ] + [warehouse]


def repair_overlap(
    problem: Problem,
    routes: list[list[int]],
    osrm,
    warehouse: tuple[float, float],
    log=print,
):
    cfg = problem.cfg

    def analyse(current_routes):
        road_routes = []
        segment_lists = []
        for route in current_routes:
            if len(route) <= 1:
                segment_lists.append([])
                road_routes.append(None)
                continue
            road = osrm.route(_route_points(problem, route, warehouse))
            road_routes.append(road)
            segment_lists.append(segments(road))
        return road_routes, fleet_overlap(segment_lists, cfg.ignore_wh_m)

    _, pairs = analyse(routes)
    current_overlap = sum(pairs.values())
    current_cost = sum(problem.rcost(route) for route in routes)

    for iteration in range(cfg.repair_iters):
        if current_overlap <= cfg.overlap_tol_m or not pairs:
            break

        source_target = max(pairs, key=pairs.get)
        i, j = source_target
        best = None

        for source, target in ((i, j), (j, i)):
            for pos in range(len(routes[source]) - 1):
                store = routes[source][pos]
                source_route = routes[source][:pos] + routes[source][pos + 1:]

                for target_pos in range(len(routes[target])):
                    target_route = (
                        routes[target][:target_pos]
                        + [store]
                        + routes[target][target_pos:]
                    )

                    if not problem.ok(source_route, source):
                        continue
                    if not problem.ok(target_route, target):
                        continue

                    trial = [route[:] for route in routes]
                    trial[source] = source_route
                    trial[target] = target_route

                    cost = sum(problem.rcost(route) for route in trial)
                    if cost > current_cost * (1 + cfg.repair_cost_slack):
                        continue

                    _, trial_pairs = analyse(trial)
                    overlap = sum(trial_pairs.values())

                    if overlap < current_overlap - 1:
                        if best is None or overlap < best[0]:
                            best = (overlap, trial, trial_pairs, cost)

        if best is None:
            log("overlap repair: no improving move found")
            break

        current_overlap, routes, pairs, current_cost = best
        log(
            "overlap repair %d: %.2f km",
            iteration + 1,
            current_overlap / 1000,
        )

    return routes
