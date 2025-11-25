# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive PCI (Physical Cell Identity) planning tool for LTE and NR (5G) networks with both GUI and CLI interfaces. The tool supports PCI planning, network parameter updates, and neighbor planning with advanced algorithms for distance-based planning and dual-mod constraints.

## Running the Application

### GUI Version (Main Application)
```bash
python NetworkPlanningTool_V1.py
# or on Windows
run_gui.bat
```

### CLI Version (Legacy)
```bash
python planning_lte_nr_enhanced.py
# or on Windows
run.bat
```

### Dependencies
```bash
pip install pandas numpy openpyxl tkinter cryptography
```

## License Management

The application includes a license verification system that must be validated before use:
- License file: `license.dat`
- Contact information for license issues: weicongpeng1@163.com or 15220958556
- License validation occurs on application startup
- Invalid licenses will display an error message and exit

## Code Architecture

### Main Components

#### 1. NetworkPlanningTool_V1.py (GUI Version)
**Primary application with tkinter-based GUI**
- License verification on startup
- Three main functional modules:
  - PCI Planning
  - Network Parameter Updates
  - Neighbor Planning
- Threaded execution for responsive UI
- Real-time progress reporting

#### 2. planning_lte_nr_enhanced.py (CLI Version)
**Legacy command-line interface**
- Same core functionality as GUI version
- Interactive menu system
- Batch processing capabilities

#### 3. License Management System
- `license_manager.py`: Handles license validation and encryption
- Uses Fernet encryption with HMAC signature verification
- License expiration checking
- Tamper detection

### Core Functional Classes

#### NetworkParameterUpdater
- Updates network parameters from compressed data archives
- Handles fuzzy column matching for compatibility
- Protects header rows (indices 0-2) using `df.loc[3:, ...]`
- Timestamp-based file selection (14-digit YYYYMMDDHHMMSS format)

#### NeighborPlanningTool
- Generates neighbor cell relationships based on distance thresholds
- Supports three planning types: NR-to-NR, LTE-to-LTE, NR-to-LTE
- Independent parameter settings for each planning type
- Distance-based neighbor discovery with maximum neighbor count control

#### LTENRPCIPlanner
- Core PCI planning algorithms with advanced constraint handling
- Distance priority: same-frequency same-PCI cells must maintain minimum reuse distance
- Dual-mod constraints for NR networks (mod3 AND mod30)
- Smart fallback strategy with constraint relaxation
- Same-site conflict avoidance

## Key Implementation Rules

### Data Processing
- **Header Protection**: Always use `df.loc[3:, ...]` for data operations (data starts at index 3)
- **Timestamp Format**: All output files use `YYYYMMDD_HHMMSS` format
- **Distance Priority**: Only same-frequency AND same-PCI cells require distance checking
- **Same-Site Detection**: < 0.01km (10 meters) indicates same physical location

### PCI Planning Constraints
- **LTE**: Single mod3 constraint
- **NR**: Dual mod3 AND mod30 constraints
- **Default Reuse Distance**: 3.0km with smart fallback to 2.0km
- **PCI Ranges**: LTE (0-503), NR (0-1007)

### Cache Management
Three types of caches cleared after each PCI assignment:
- `distance_cache` - Distance calculations
- `pci_validity_cache` - PCI validation results
- `same_site_cache` - Same-site cell lookups

## File Structure

```
/
├── NetworkPlanningTool_V1.py          # Main GUI application
├── planning_lte_nr_enhanced.py        # Legacy CLI application
├── license_manager.py                 # License validation system
├── license_generator.py               # License generation utility
├── license.dat                        # License file
├── run_gui.bat                        # Windows GUI launcher
├── run.bat                            # Windows CLI launcher
├── 全量工参/                          # Full network parameter files
│   └── ProjectParameter_mongoose*.xlsx
├── 待规划小区/                        # Cells to be planned
│   └── cell-tree-export-*.xlsx
└── 输出文件/                          # Output files
    ├── pci_planning_*.xlsx
    └── neighbor_planning_*.xlsx
```

## Development Guidelines

### When Modifying Code
- Never modify header rows (indices 0-2)
- Always use `df.loc[3:, ...]` for data operations
- Maintain timestamp format consistency
- Test with both LTE and NR data
- Verify license management functionality

### Error Handling
- Check for license validation errors first
- Handle missing files with clear error messages
- Validate input data formats before processing
- Implement graceful fallback for constraint violations

### Performance Considerations
- Use caching for distance calculations
- Clear caches appropriately to prevent memory leaks
- Consider threading for GUI responsiveness
- Optimize DataFrame operations for large datasets