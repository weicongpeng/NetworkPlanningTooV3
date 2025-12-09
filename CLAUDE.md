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

### License Generator
```bash
python license_generator.py
# or on Windows
run_license.bat
```

### Dependencies
```bash
# Core dependencies
pip install pandas numpy openpyxl cryptography

# GUI framework (usually included with Python)
# tkinter
```

**Algorithm Parameters**:
- k = 5/9: Distance coefficient from site to coverage center
- m = 5/9: Coverage radius coefficient
- Default max neighbors: 32 per cell

### Testing and Development
**Note**: No automated test suite currently exists in the repository.

**Manual Testing Approaches**:
1. **Small Dataset Testing**: Use datasets with <100 cells for quick validation
2. **Core Algorithm Verification**:
   - Test PCI assignment with known constraints
   - Verify distance calculations using known coordinate pairs
   - Check same-site detection (<0.01km threshold)
3. **Integration Testing**:
   - Test license validation flow
   - Verify file I/O operations
   - Test GUI responsiveness during processing

**Code Quality Tools** (not currently configured):
- **Formatting**: No code formatter configured
- **Linting**: No linter configured
- **Type Checking**: Optional (no mypy configuration)
- **Documentation**: Docstrings recommended for all classes/methods

**Development Setup**:
```bash
# Clone repository
git clone <repository-url>
cd NetworkPlanningTool

# Install dependencies
# Core dependencies
pip install pandas numpy openpyxl cryptography

# Run application
python NetworkPlanningTool_V1.py
```

## License Management

The application includes a license verification system that must be validated before use:
- **License file**: `license.dat`
- **Contact information**: weicongpeng1@163.com or 15220958556
- **Validation**: Automatic license check on application startup
- **Invalid licenses**: Display error message and exit gracefully
- **Generator tool**: `license_generator.py` for creating and validating licenses
- **Encryption**: Uses Fernet encryption with HMAC signature verification
- **Tamper detection**: Validates license integrity and expiration date

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

#### 1. NetworkPlanningTool_V1.py (Main Application)
**Primary application with tkinter-based GUI and integrated license verification**
- **License verification**: Embedded license check at startup (first 100 lines)
- **Three main functional modules**:
  - PCI Planning
  - Network Parameter Updates
  - Neighbor Planning
- **Threaded execution**: Background processing for responsive UI
- **Real-time progress reporting**: Console output and GUI progress bars
- **Size**: ~5300 lines

#### 2. License Management System
**Integrated license validation and generation tools**
- **Integrated validation**: License check embedded in main program
- `license_generator.py`: Interactive license generation and validation tool
  - Generate new licenses with customizable expiration dates
  - Check existing license validity
  - Uses Fernet encryption + HMAC signature verification
  - Provides clear error messages for invalid/tampered licenses

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
├── NetworkPlanningTool_V1.py          # Main GUI application (~5300 lines)
├── license_generator.py               # License generation utility
├── license.dat                        # License file
├── run_gui.bat                        # Windows GUI launcher
├── run_license.bat                    # Windows license generator launcher
├── README.md                          # User documentation
├── CLAUDE.md                          # Developer guide (this file)
├── IFLOW.md                           # iFlow CLI context
├── 全量工参/                          # Full network parameter files
│   └── ProjectParameter_mongoose*.xlsx
├── 待规划小区/                        # Cells to be planned
│   └── cell-tree-export-*.xlsx
└── 输出文件/                          # Output files
    ├── pci_planning_*.xlsx
    ├── neighbor_planning_*.xlsx
    └── ProjectParameter_mongoose_updated_*.xlsx
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
- **Data Protection**: Never modify header rows (indices 0-2), always use `df.loc[3:, ...]`
- **Timestamp Format**: Maintain `YYYYMMDD_HHMMSS` format consistency for all output files
- **Testing**: Test with both LTE and NR data sets
- **License Management**: Verify license validation functionality after changes

### Error Handling
- **License Validation**: Check for license errors first (embedded in main program startup)
- **File Operations**: Handle missing files with clear, actionable error messages
- **Data Validation**: Validate input Excel formats before processing
- **Constraint Violations**: Implement graceful fallback for PCI planning conflicts

### Performance Considerations
- **Caching**: Use and properly clear caches for distance calculations (`distance_cache`, `pci_validity_cache`, `same_site_cache`)
- **Memory Management**: Clear caches after each PCI assignment to prevent memory leaks
- **Threading**: Use background threads for GUI responsiveness during heavy processing
- **DataFrame Optimization**: Use vectorized operations for large datasets (>100MB files)

## Debugging and Troubleshooting

### Common Issues

**License Validation Failure**
- Check `license.dat` file exists in root directory
- Verify file has not been tampered with (HMAC signature validation)
- Use `license_generator.py` to generate a new license
- Contact: weicongpeng1@163.com or 15220958556

**License Generator Issues**
- Run with `python license_generator.py` or `run_license.bat`
- Check license expiration date format (YYYY-MM-DD)
- Ensure generated license has correct permissions (readable by main application)
- Test generated license immediately with option 2 or 3 in the generator

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