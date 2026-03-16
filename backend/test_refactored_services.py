import pytest
import pandas as pd
import math
from app.algorithms.pci_planning_v1_service import LTENRPCIPlanner, PlanningConfig
from app.algorithms.neighbor_planning_v1_service import NeighborPlanner, NeighborConfig

class TestV1Services:
    def test_pci_planner_instantiation(self):
        """Test instantiation of PCI Planner V1"""
        # Create config
        config_lte = PlanningConfig(
            network_type='LTE',
            reuse_distance_km=3.0,
            inherit_mod=False
        )
        
        # Test LTE mode instantiation
        planner = LTENRPCIPlanner(config_lte)
        assert planner.reuse_distance_km == 3.0
        assert planner.mod_value == 3
        
        # Create config NR
        config_nr = PlanningConfig(
            network_type='NR',
            reuse_distance_km=5.0,
            inherit_mod=True
        )
        
        # Test NR mode instantiation
        planner_nr = LTENRPCIPlanner(config_nr)
        assert planner_nr.reuse_distance_km == 5.0
        assert planner_nr.mod_value == 30

    def test_neighbor_planner_config(self):
        """Test instantiation and config of Neighbor Planner V1"""
        config = NeighborConfig(
            source_type='LTE',
            target_type='LTE',
            max_neighbors=32,
            coverage_distance_factor=1.0,
            coverage_radius_factor=1.0
        )
        
        assert config.source_type == 'LTE'
        assert config.target_type == 'LTE'
        assert config.max_neighbors == 32
        
        planner = NeighborPlanner(config)
        assert planner.config == config
        assert planner.max_neighbors == 32

    def test_neighbor_planner_distance_calc(self):
        """Test helper method for distance calculation in NeighborPlanner"""
        config = NeighborConfig(
            source_type='LTE',
            target_type='LTE'
        )
        planner = NeighborPlanner(config)
        
        # Test distance: (0,0) to (0,1) deg
        # 1 deg lat ~ 111km
        dist_lat = planner.calculate_distance(0, 0, 1, 0)
        assert 110 < dist_lat < 112
        
        # Test distance: (0,0) to (0,1) deg lon
        dist_lon = planner.calculate_distance(0, 0, 0, 1)
        assert 110 < dist_lon < 112
