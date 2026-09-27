from __future__ import annotations

from dataclasses import dataclass
import math


BIG = 1e9


@dataclass(slots=True)
class Store:
    id: str
    lat: float
    lon: float
    demand: float = 1.0
    service_s: float = 300.0
    value: float = 1.0


@dataclass(slots=True)
class Config:
    n_vehicles: int
    vehicle_capacities: list[float]
    max_dist_m: float = 80_000.0
    max_time_s: float = 5 * 3600.0
    lam_back: float = 2.0
    lam_lat: float = 1.0
    corridor: float = 0.3
    mu: float = 0.5
    restarts: int = 25
    time_limit_s: float = 30.0
    seed: int = 7
    fuel_l_per_km: float = 0.12
    fuel_load_factor: float = 0.25
    ignore_wh_m: float = 1500.0
    overlap_tol_m: float = 500.0
    repair_iters: int = 8
    repair_cost_slack: float = 0.15

    def __post_init__(self) -> None:
        if self.n_vehicles <= 0:
            raise ValueError("n_vehicles must be greater than zero")
        if len(self.vehicle_capacities) != self.n_vehicles:
            raise ValueError(
                "vehicle_capacities length must equal n_vehicles"
            )
        if any(cap <= 0 for cap in self.vehicle_capacities):
            raise ValueError("Vehicle capacities must be greater than zero")

    def capacity_for_vehicle(self, vehicle_index: int) -> float:
        return self.vehicle_capacities[vehicle_index]


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    r = 6_371_000.0
    p1 = math.radians(a[0])
    p2 = math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = (
        math.sin(dp / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(h))


def bearing(a: tuple[float, float], b: tuple[float, float]) -> float:
    p1 = math.radians(a[0])
    p2 = math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    y = math.sin(dl) * math.cos(p2)
    x = (
        math.cos(p1) * math.sin(p2)
        - math.sin(p1) * math.cos(p2) * math.cos(dl)
    )
    return math.atan2(y, x)


def angdiff(a: float, b: float) -> float:
    d = abs(a - b) % (2 * math.pi)
    return min(d, 2 * math.pi - d)


class Problem:
    """Immutable optimization problem built from a store list and road matrix."""

    def __init__(
        self,
        stores: list[Store],
        warehouse: tuple[float, float],
        config: Config,
        distance: list[list[float]],
        duration: list[list[float]],
    ) -> None:
        self.st = stores
        self.cfg = config
        self.D = distance
        self.T = duration
        self.n = len(stores)
        self.W = self.n

        self.dw = [distance[i][self.W] for i in range(self.n)] + [0.0]
        self.bear = [bearing(warehouse, (s.lat, s.lon)) for s in stores]
        self.dem = [s.demand for s in stores] + [0.0]
        self.svc = [s.service_s for s in stores] + [0.0]
        self.val = [s.value for s in stores] + [0.0]

        n = self.n
        self.C = [[0.0] * (n + 1) for _ in range(n + 1)]

        for i in range(n):
            for j in range(n + 1):
                if i == j:
                    continue
                d = distance[i][j]
                outward = max(0.0, self.dw[j] - self.dw[i])
                lateral = max(0.0, d - max(0.0, self.dw[i] - self.dw[j]))
                self.C[i][j] = (
                    d
                    + config.lam_back * outward
                    + config.lam_lat * lateral
                )

    def stats(self, route: list[int]) -> tuple[float, float, float]:
        distance = 0.0
        duration = 0.0
        for a, b in zip(route, route[1:]):
            distance += self.D[a][b]
            duration += self.T[a][b] + self.svc[a]
        demand = sum(self.dem[x] for x in route[:-1])
        return distance, duration, demand

    def ok(self, route: list[int], vehicle_index: int) -> bool:
        distance, duration, demand = self.stats(route)
        capacity = self.cfg.capacity_for_vehicle(vehicle_index)
        return (
            demand <= capacity
            and distance <= self.cfg.max_dist_m
            and duration <= self.cfg.max_time_s
        )

    def mean_bearing(self, stores: list[int]) -> float:
        return math.atan2(
            sum(math.sin(self.bear[x]) for x in stores),
            sum(math.cos(self.bear[x]) for x in stores),
        )

    def rcost(self, route: list[int]) -> float:
        cost = sum(self.C[a][b] for a, b in zip(route, route[1:]))
        if len(route) > 2 and self.cfg.corridor:
            mb = self.mean_bearing(route[:-1])
            cost += self.cfg.corridor * sum(
                self.dw[x] * angdiff(self.bear[x], mb) / math.pi
                for x in route[:-1]
            )
        return cost

    def objective(self, costs: list[float]) -> float:
        if not costs:
            return 0.0
        return sum(costs) + self.cfg.mu * max(costs)

    def reachable(self, x: int) -> bool:
        return (
            any(
                self.dem[x] <= self.cfg.capacity_for_vehicle(k)
                for k in range(self.cfg.n_vehicles)
            )
            and self.D[x][self.W] <= self.cfg.max_dist_m
            and self.T[x][self.W] + self.svc[x] <= self.cfg.max_time_s
        )
