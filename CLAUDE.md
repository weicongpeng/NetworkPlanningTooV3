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

### Testing and Development
```bash
python test.py  # Test coverage circle neighbor planning algorithm
```

**Algorithm Parameters**:
- k = 5/9: Distance coefficient from site to coverage center
- m = 5/9: Coverage radius coefficient
- Default max neighbors: 32 per cell

## License Management

The application includes a license verification system that must be validated before use:
- License file: `license.dat`
- Contact information for license issues: weicongpeng1@163.com or 15220958556
- License validation occurs on application startup
- Invalid licenses will display an error message and exit

## Input File Requirements

### PCI Planning Input (待规划小区/)
Expected format: `cell-tree-export-*.xlsx`
- Must contain columns for cell identification, coordinates, frequency, etc.
- Supports fuzzy column name matching (e.g., "物理小区识别码" matches variations)

### Network Parameters (全量工参/)
Expected format: `ProjectParameter_mongoose*.xlsx`
- **Critical**: First 3 rows (indices 0-2) are headers and MUST NOT be modified
- Data starts from row 4 (index 3)
- Timestamp format in filename: YYYYMMDDHHMMSS (14 digits)

### Parameter Update Source
Expected format: `BaselineLab_*.zip` (compressed archive)
- Contains LTE_SDR/LTE_ITBBU and NR online parameter files
- System automatically extracts and selects latest timestamp files

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

## Advanced Features

### Fuzzy Column Matching
The tool implements intelligent column name matching to handle variations:
- Automatically finds columns with similar names
- Supports different naming conventions (e.g., 'cellName' vs 'CellName')
- Enables compatibility across different data source formats

### Neighbor Planning Coverage Circle Algorithm
Uses geometric circle intersection to determine neighbor relationships:
- Coverage circle center: Located at distance `k*Co` from site in azimuth direction
- Coverage radius: `m*Co` where Co is forward coverage distance
- Neighbor condition: Circle intersection OR same-site location
- Priority sorting: By distance between coverage circle centers

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

## Output Files

All outputs are saved to `输出文件/` directory with timestamp:

### PCI Planning Output
- Format: `pci_planning_YYYYMMDD_HHMMSS.xlsx`
- Contains assigned PCIs with conflict resolution details
- Includes constraint satisfaction status and fallback information

### Neighbor Planning Output
- Format: `neighbor_planning_YYYYMMDD_HHMMSS.xlsx`
- Three planning types: NR-NR, LTE-LTE, NR-LTE
- Distance-based neighbor relationships with configurable thresholds

### Updated Parameters
- Format: `ProjectParameter_mongoose_updated_YYYYMMDD_HHMMSS.xlsx`
- Preserves original header rows (0-2)
- Shows updated and new cell counts in console log

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

## Debugging and Troubleshooting

### Common Issues

**License Validation Failure**
- Check license.dat file exists in root directory
- Verify file has not been tampered with
- Contact: weicongpeng1@163.com or 15220958556

**Missing Input Files**
- Verify directory structure: `全量工参/`, `待规划小区/`
- Check file naming patterns match expected formats
- Ensure Excel files are not corrupted or password-protected

**PCI Planning Conflicts**
- Tool uses smart fallback: 3.0km → 2.0km reuse distance
- Check console output for constraint relaxation messages
- Verify frequency and mod constraint settings
- Review same-site cells (< 10 meters) for conflicts

**Parameter Update Issues**
- Ensure BaselineLab_*.zip contains valid Excel files
- Check timestamp format in filenames (14-digit YYYYMMDDHHMMSS)
- Verify header rows (0-2) are intact in ProjectParameter files
- Confirm fuzzy column matching finds required columns

**GUI Freezing or Unresponsive**
- Operations run in background threads for responsiveness
- Check console output for progress messages
- Large datasets may take several minutes to process
- Monitor memory usage for very large files (> 100MB)