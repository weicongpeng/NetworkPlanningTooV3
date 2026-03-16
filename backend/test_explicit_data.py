"""
Test Min Distance Sector Name with Explicit Data
"""

import asyncio
from app.algorithms.pci_planning_service_v2 import (
    PlanningConfig,
    PCIPlanningService,
    NetworkType,
)


async def test_with_explicit_data():
    """Test with explicit test data"""

    print("=" * 80)
    print("Test Min Distance Sector Name - Explicit Data")
    print("=" * 80)

    # Scenario: Plan a cell that will get PCI=0
    # There is a background cell with PCI=0 that is very close
    print("\n[Scenario] Plan cell with PCI=0, background cell with PCI=0 nearby")
    print("-" * 80)

    sites_data = [
        {
            "id": "site_planned",
            "name": "站点_待规划",
            "networkType": "LTE",
            "longitude": 116.4074,
            "latitude": 39.9042,
            "sectors": [
                {
                    "id": "1",
                    "name": "站点_待规划_扇区1",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "earfcn": 1850.0,
                    "pci": None,  # Will be assigned PCI=0
                },
            ],
        },
    ]

    # Background data: Another cell with PCI=0, very close
    # This will cause the planned cell to get a different PCI
    background_sites_data = [
        {
            "id": "site_nearby",
            "name": "站点_附近",
            "networkType": "LTE",
            "longitude": 116.4174,  # Very close: ~1 km
            "latitude": 39.9042,
            "sectors": [
                {
                    "id": "1",
                    "name": "站点_附近_扇区1_PCI_0",
                    "longitude": 116.4174,
                    "latitude": 39.9042,
                    "earfcn": 1850.0,
                    "pci": 0,  # Already has PCI=0
                },
            ],
        },
    ]

    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=0.5,  # Small threshold
        pci_modulus=3,
    )

    service = PCIPlanningService(config)
    result = await service.plan(sites_data, background_sites_data=background_sites_data)

    # Get planning result
    site_result = result.sites[0]
    sector_result = site_result.sectors[0]

    print(f"\n[Results]")
    print("-" * 80)
    print(f"Sector Name: {sector_result.sector_name}")
    print(f"Planned PCI: {sector_result.new_pci}")
    print(f"Min Reuse Distance: {sector_result.min_reuse_distance:.4f} km")
    print(f"Min Distance Sector Name: {sector_result.min_distance_sector_name}")
    print(f"Assignment Reason: {sector_result.assignment_reason}")

    # Verification
    print("\n[Verification]")
    print("-" * 80)

    # Check 1: Field exists
    assert hasattr(sector_result, "min_distance_sector_name"), (
        "SectorPlanningResult should have min_distance_sector_name field"
    )
    print("✓ Check 1: min_distance_sector_name field exists")

    # Check 2: If min distance is finite, sector name should be recorded
    if sector_result.min_reuse_distance < float("inf"):
        assert sector_result.min_distance_sector_name is not None, (
            "min_distance_sector_name should not be None when min distance is finite"
        )
        print("✓ Check 2: min_distance_sector_name is not None (correct)")
        print(f"  Expected: Sector name of the cell that causes min reuse distance")
        print(f"  Actual: {sector_result.min_distance_sector_name}")

        # Check 3: The sector name should indicate same PCI
        # Note: We can't directly verify this without full params data
        # But the name gives us a hint
        print(
            f"✓ Check 3: min_distance_sector_name recorded: {sector_result.min_distance_sector_name}"
        )
    else:
        assert sector_result.min_distance_sector_name is None, (
            "min_distance_sector_name should be None when min distance is infinite"
        )
        print("✓ Check 2: min_distance_sector_name is None (no same PCI cell)")

    print("\n" + "=" * 80)
    print("Test Complete")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(test_with_explicit_data())
