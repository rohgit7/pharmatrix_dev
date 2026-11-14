import pytest
from fastapi import HTTPException

from app.optimizer import Config, HaversineProvider, Store, solve
from app.services.route_optimization_service import (
    _validate_optimizer_output,
    _validate_route_inputs,
)


def run_optimizer(stores, *, capacities, warehouse=(12.9716, 77.5946)):
    config = Config(
        n_vehicles=len(capacities),
        vehicle_capacities=capacities,
        max_dist_m=100_000,
        max_time_s=24 * 60 * 60,
        restarts=1,
        time_limit_s=1,
    )
    return solve(
        stores=stores,
        warehouse=warehouse,
        config=config,
        provider=HaversineProvider(),
        log=lambda *args: None,
    )


def test_empty_pickup_set_returns_only_trivial_depot_routes():
    problem, routes, uncovered, unreachable = run_optimizer(
        [],
        capacities=[100, 100],
    )

    assert problem.n == 0
    assert problem.W == 0
    assert routes == [[0], [0]]
    assert uncovered == []
    assert unreachable == []
    assert _validate_optimizer_output(
        stores=[],
        problem=problem,
        optimized_routes=routes,
        uncovered=uncovered,
        unreachable=unreachable,
        vehicle_count=2,
    ) == [(0, []), (1, [])]


def test_single_pickup_uses_zero_based_pickup_and_terminal_depot_nodes():
    stores = [
        Store(
            id="41",
            lat=12.9352,
            lon=77.6245,
            demand=10,
        )
    ]

    problem, routes, uncovered, unreachable = run_optimizer(
        stores,
        capacities=[100],
    )

    assert routes == [[0, 1]]
    assert uncovered == []
    assert unreachable == []
    assert _validate_optimizer_output(
        stores=stores,
        problem=problem,
        optimized_routes=routes,
        uncovered=uncovered,
        unreachable=unreachable,
        vehicle_count=1,
    ) == [(0, [0])]


def test_multiple_pickups_are_each_assigned_once_across_vehicles():
    stores = [
        Store(id="41", lat=12.9352, lon=77.6245, demand=10),
        Store(id="42", lat=12.9452, lon=77.6145, demand=12),
        Store(id="43", lat=12.9552, lon=77.6045, demand=8),
    ]

    problem, routes, uncovered, unreachable = run_optimizer(
        stores,
        capacities=[20, 20],
    )
    validated_routes = _validate_optimizer_output(
        stores=stores,
        problem=problem,
        optimized_routes=routes,
        uncovered=uncovered,
        unreachable=unreachable,
        vehicle_count=2,
    )

    assigned_nodes = [node for _, route_nodes in validated_routes for node in route_nodes]
    assert sorted(assigned_nodes) == [0, 1, 2]
    assert len(assigned_nodes) == len(set(assigned_nodes))
    assert not uncovered
    assert not unreachable


def test_infeasible_pickup_is_classified_as_unreachable():
    stores = [
        Store(id="41", lat=12.9352, lon=77.6245, demand=11),
    ]

    problem, routes, uncovered, unreachable = run_optimizer(
        stores,
        capacities=[10],
    )

    validated_routes = _validate_optimizer_output(
        stores=stores,
        problem=problem,
        optimized_routes=routes,
        uncovered=uncovered,
        unreachable=unreachable,
        vehicle_count=1,
    )

    assert validated_routes == [(0, [])]
    assert uncovered == []
    assert unreachable == [0]


def test_out_of_range_optimizer_node_returns_gateway_error_not_index_error():
    stores = [
        Store(id="41", lat=12.9352, lon=77.6245, demand=10),
    ]
    problem, _, _, _ = run_optimizer(stores, capacities=[100])

    with pytest.raises(HTTPException) as exc:
        _validate_optimizer_output(
            stores=stores,
            problem=problem,
            optimized_routes=[[2, 1]],
            uncovered=[],
            unreachable=[],
            vehicle_count=1,
        )

    assert exc.value.status_code == 502
    assert exc.value.detail["message"] == "Route optimizer returned invalid output"
    assert "invalid route pickup node 2" in exc.value.detail["reason"]


def test_omitted_pickup_is_rejected_instead_of_silently_dropped():
    stores = [
        Store(id="41", lat=12.9352, lon=77.6245, demand=10),
        Store(id="42", lat=12.9452, lon=77.6145, demand=10),
    ]
    problem, _, _, _ = run_optimizer(stores, capacities=[100])

    with pytest.raises(HTTPException) as exc:
        _validate_optimizer_output(
            stores=stores,
            problem=problem,
            optimized_routes=[[0, 2]],
            uncovered=[],
            unreachable=[],
            vehicle_count=1,
        )

    assert exc.value.status_code == 502
    assert exc.value.detail["pickup_node_indices"] == [1]


def test_route_violating_capacity_is_rejected():
    stores = [
        Store(id="41", lat=12.9352, lon=77.6245, demand=11),
    ]
    problem, _, _, _ = run_optimizer(stores, capacities=[10])

    with pytest.raises(HTTPException) as exc:
        _validate_optimizer_output(
            stores=stores,
            problem=problem,
            optimized_routes=[[0, 1]],
            uncovered=[],
            unreachable=[],
            vehicle_count=1,
        )

    assert exc.value.status_code == 502
    assert "violates capacity, distance, or duration constraints" in exc.value.detail["reason"]


def test_duplicate_pickup_assignment_is_rejected_before_persistence():
    route_inputs = [
        {"pickup_ids": [41]},
        {"pickup_ids": [41]},
    ]

    with pytest.raises(HTTPException) as exc:
        _validate_route_inputs(route_inputs, {41})

    assert exc.value.status_code == 502
    assert exc.value.detail["pickup_ids"] == [41]
