from __future__ import annotations

import time

from app.optimizer.problem import Problem


def local_search(problem: Problem, routes: list[list[int]], deadline: float) -> list[list[int]]:
    costs = [problem.rcost(route) for route in routes]

    def apply(changes: dict[int, list[int]]) -> bool:
        for vehicle_index, route in changes.items():
            if not problem.ok(route, vehicle_index):
                return False

        new_costs = costs[:]
        for vehicle_index, route in changes.items():
            new_costs[vehicle_index] = problem.rcost(route)

        if problem.objective(new_costs) < problem.objective(costs) - 1e-6:
            for vehicle_index, route in changes.items():
                routes[vehicle_index] = route
                costs[vehicle_index] = new_costs[vehicle_index]
            return True

        return False

    def relocate() -> bool:
        k_count = len(routes)
        for source in range(k_count):
            for index in range(len(routes[source]) - 1):
                store = routes[source][index]
                base = routes[source][:index] + routes[source][index + 1:]

                for target in range(k_count):
                    for position in range(len(routes[target])):
                        if source == target and position == index:
                            continue

                        target_route = (
                            base[:position] + [store] + base[position:]
                            if source == target
                            else routes[target][:position] + [store] + routes[target][position:]
                        )

                        changes = {source: target_route} if source == target else {
                            source: base,
                            target: target_route,
                        }

                        if apply(changes):
                            return True
        return False

    def swap() -> bool:
        k_count = len(routes)
        for a in range(k_count):
            for b in range(a + 1, k_count):
                for i in range(len(routes[a]) - 1):
                    for j in range(len(routes[b]) - 1):
                        ra = routes[a][:]
                        rb = routes[b][:]
                        ra[i], rb[j] = rb[j], ra[i]
                        if apply({a: ra, b: rb}):
                            return True
        return False

    def two_opt() -> bool:
        for vehicle_index, route in enumerate(routes):
            for i in range(len(route) - 2):
                for j in range(i + 1, len(route) - 1):
                    candidate = (
                        route[:i]
                        + route[i:j + 1][::-1]
                        + route[j + 1:]
                    )
                    if apply({vehicle_index: candidate}):
                        return True
        return False

    while time.time() < deadline:
        if relocate():
            continue
        if swap():
            continue
        if two_opt():
            continue
        break

    return routes
