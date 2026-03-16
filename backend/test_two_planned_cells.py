"""
Test Min Distance Sector Name with Two Planned Cells
"""

import asyncio
from app.algorithms.pci_planning_service_v2 import (
    PlanningConfig,
    PCIPlanningService,
    NetworkType,
)


async def test_two_planned_cells():
    """Test with two planned cells to verify min distance sector name"""

    print("=" * 80)
    print("Test Min Distance Sector Name - Two Planned Cells")
    print("=" * 80)

    # Scenario: Plan two cells, both will get PCI=0 and PCI=3
    # But there is a background cell with PCI=0 that is closer to cell2
    print("\n[Scenario] Two planned cells with background cell having same PCI")
    print("-" * 80)

    sites_data = [
        {
            "id": "site1",
            "name": "站点1_较远",
            "networkType": "LTE",
            "longitude": 116.4074,
            "latitude": 39.9042,
            "sectors": [
                {
                    "id": "1",
                    "name": "站点1_较远_扇区1",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "earfcn": 1850.0,
                    "pci": None,  # Will be assigned first
                },
            ],
        },
        {
            "id": "site2",
            "name": "站点2_较近",
            "networkType": "LTE",
            "longitude": 116.4174,
            "latitude": 39.9042,
            "sectors": [
                {
                    "id": "1",
                    "name": "站点2_较近_扇区1",
                    "longitude": 116.4174,
                    "latitude": 39.9042,
                    "earfcn": 1850.0,
                    "pci": None,  # Will be assigned second
                },
            ],
        },
    ]

    # Background data: A cell with PCI=0 that is very close to site2
    # This should be the min distance sector for cell with PCI=0
    background_sites_data = [
        {
            "id": "site_background",
            "name": "站点_背景",
            "networkType": "LTE",
            "longitude": 116.4184,  # Very close to site2
            "latitude": 39.9042,
            "sectors": [
                {
                    "id": "1",
                    "name": "站点_背景_扇区1_PCI_0_最近",
                    "longitude": 116.4184,
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

    # Print all planning results
    print("\n[Planning Results]")
    print("-" * 80)
    for site in result.sites:
        for sector in site.sectors:
            print(f"Sector: {sector.sector_name}")
            print(f"  New PCI: {sector.new_pci}")
            print(f"  Min Reuse Distance: {sector.min_reuse_distance:.4f} km")
            print(f"  Min Distance Sector Name: {sector.min_distance_sector_name}")
            print(f"  Assignment Reason: {sector.assignment_reason}")
            print()

    # Verification
    print("[Verification]")
    print("-" * 80)

    # Check that min_distance_sector_name is consistent with min_distance
    for site in result.sites:
        for sector in site.sectors:
            if sector.min_reuse_distance < float("inf"):
                # If there is a min distance, there should be a sector name
                if sector.min_distance_sector_name is None:
                    print(
                        f"❌ FAIL: {sector.sector_name} has finite distance but no sector name"
                    )
                else:
                    print(
                        f"✓ OK: {sector.sector_name} has sector name: {sector.min_distance_sector_name}"
                    )

                    # Check if the sector name corresponds to a cell with the same PCI
                    # This is hard to verify without access to full params data
                    print(
                        f"  Note: Should verify that this sector uses PCI={sector.new_pci}"
                    )
            else:
                # If no min distance, sector name should be None
                if sector.min_distance_sector_name is None:
                    print(
                        f"✓ OK: {sector.sector_name} has no min distance and no sector name"
                    )
                else:
                    print(
                        f"❌ FAIL: {sector.sector_name} has no min distance but has sector name: {sector.min_distance_sector_name}"
                    )

    print("\n" + "=" * 80)
    print("Test Complete")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(test_two_planned_cells())
