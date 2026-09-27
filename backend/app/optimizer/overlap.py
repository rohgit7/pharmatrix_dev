def segments(route_json: dict):
    result = []
    for leg in route_json.get("legs", []):
        nodes = leg.get("annotation", {}).get("nodes", [])
        distances = leg.get("annotation", {}).get("distance", [])
        for i, length in enumerate(distances):
            if i + 1 < len(nodes):
                result.append((nodes[i], nodes[i + 1], length))
    return result


def backtrack_m(seg_list) -> float:
    seen = set()
    total = 0.0
    for a, b, length in seg_list:
        if a == b:
            continue
        key = frozenset((a, b))
        if key in seen:
            total += length
        else:
            seen.add(key)
    return total


def edge_set(seg_list, ignore_m: float):
    result = {}
    accumulated = 0.0
    for a, b, length in reversed(seg_list):
        accumulated += length
        if accumulated <= ignore_m or a == b:
            continue
        result[frozenset((a, b))] = length
    return result


def fleet_overlap(seg_lists, ignore_m: float):
    sets = [edge_set(seg_list, ignore_m) for seg_list in seg_lists]
    pairs = {}
    for i in range(len(sets)):
        for j in range(i + 1, len(sets)):
            overlap = sum(
                min(length, sets[j][edge])
                for edge, length in sets[i].items()
                if edge in sets[j]
            )
            if overlap > 0:
                pairs[(i, j)] = overlap
    return pairs
