from __future__ import annotations

import json
import urllib.request

from app.optimizer.problem import BIG


class OSRMProvider:
    def __init__(
        self,
        base: str = "http://localhost:5000",
        profile: str = "driving",
    ) -> None:
        self.base = base.rstrip("/")
        self.profile = profile
        self._cache: dict[tuple[tuple[float, float], ...], dict] = {}

    def _get(self, url: str) -> dict:
        with urllib.request.urlopen(url, timeout=120) as response:
            return json.loads(response.read())

    def matrices(self, points: list[tuple[float, float]]):
        coords = ";".join(
            f"{lon:.6f},{lat:.6f}" for lat, lon in points
        )
        data = self._get(
            f"{self.base}/table/v1/{self.profile}/{coords}"
            "?annotations=distance,duration"
        )
        clean = lambda matrix: [
            [BIG if value is None else float(value) for value in row]
            for row in matrix
        ]
        return clean(data["distances"]), clean(data["durations"])

    def route(self, points: list[tuple[float, float]]) -> dict:
        key = tuple(points)
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        coords = ";".join(
            f"{lon:.6f},{lat:.6f}" for lat, lon in points
        )
        data = self._get(
            f"{self.base}/route/v1/{self.profile}/{coords}"
            "?overview=full&geometries=geojson"
            "&annotations=nodes,distance"
            "&continue_straight=false"
        )
        result = data["routes"][0]
        self._cache[key] = result
        return result
