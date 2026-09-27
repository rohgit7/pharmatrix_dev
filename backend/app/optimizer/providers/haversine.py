from app.optimizer.problem import haversine_m


class HaversineProvider:
    """Offline fallback. It is not road-aware."""

    def __init__(self, detour: float = 1.35, speed_kmh: float = 30.0) -> None:
        self.detour = detour
        self.speed_mps = speed_kmh / 3.6

    def matrices(self, points: list[tuple[float, float]]):
        n = len(points)
        distance = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i != j:
                    distance[i][j] = haversine_m(points[i], points[j]) * self.detour
        duration = [[d / self.speed_mps for d in row] for row in distance]
        return distance, duration
