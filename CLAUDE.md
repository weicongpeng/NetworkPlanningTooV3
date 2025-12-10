# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive PCI (Physical Cell Identity) planning tool for LTE and NR (5G) networks with both GUI and CLI interfaces. The tool supports PCI planning, network parameter updates, and neighbor planning with advanced algorithms for distance-based planning and dual-mod constraints.

## Essential Commands

### Running the Application
```bash
# Main GUI application
python NetworkPlanningTool_V1.py

# License generator
python license_generator.py
```

### Development Setup
```bash
# Install core dependencies
pip install pandas numpy openpyxl cryptography

# Optional: Install map visualization support
pip install PyQt5 PyQtWebEngine
# or
pip install PySide6

# Verify installation
python -c "import pandas, numpy, openpyxl, cryptography; print('✓ Core dependencies OK')"
```

## High-Level Architecture

### Core Components

1. **NetworkPlanningTool_V1.py** (~5300 lines)
   - Main GUI application with embedded license verification
   - Three functional modules: PCI Planning, Network Parameter Updates, Neighbor Planning
   - Threaded execution for responsive UI
   - Real-time progress reporting

2. **License Management System**
   - Embedded validation in main program (first 100 lines)
   - `license_generator.py`: Interactive license generation
   - Uses Fernet encryption with HMAC signature verification
   - License file: `license.dat`

### Key Classes and Their Responsibilities

- **PCIGUIApp**: Main GUI controller, auto-detects input files, manages thread communication
- **LTENRPCIPlanner**: Core PCI planning engine
  - LTE: mod3 constraint (0-503)
  - NR: dual mod3 + mod30 constraints (0-1007)
  - Smart fallback: 3.0km → 2.0km reuse distance
- **NeighborPlanningTool**: Coverage circle algorithm (k=5/9, m=5/9), max 32 neighbors
- **NetworkParameterUpdater**: Handles compressed archives, protects header rows

### Critical Implementation Rules

1. **Data Protection**: Never modify header rows (indices 0-2), always use `df.loc[3:, ...]`
2. **Same-Site Detection**: <0.01km (10 meters) threshold
3. **Cache Management**: Clear after each PCI assignment
   - `distance_cache`
   - `pci_validity_cache`
   - `same_site_cache`
4. **Timestamp Format**: YYYYMMDD_HHMMSS for all outputs

### File Structure Requirements
```
全量工参/              # Network parameters
├── ProjectParameter_mongoose*.xlsx
└── BaselineLab_*.zip

待规划小区/            # Cells to plan
└── cell-tree-export-*.xlsx

输出文件/              # Outputs
├── pci_planning_*.xlsx
├── neighbor_planning_*.xlsx
└── ProjectParameter_mongoose_updated_*.xlsx
```

## Testing Approach

**No automated test suite exists**. Use manual testing:
1. Small datasets (<100 cells) for quick validation
2. Verify distance calculations with known coordinates
3. Test PCI assignment with known constraints
4. Check same-site detection with <0.01km threshold

## Common Development Tasks

### Adding New Features
1. Study existing patterns in similar modules
2. Follow the threaded execution model for UI operations
3. Implement proper cache clearing after operations
4. Maintain timestamp format consistency

### Debugging Tips
- License issues: Check `license.dat` existence and validity first
- File operations: Verify directory structure and naming patterns
- Performance: Monitor cache usage for large datasets (>100MB)
- GUI freezing: Operations should run in background threads

## Code Quality Notes

- No formatter/linter configured - follow existing code style
- Docstrings recommended but not required
- Error messages should be in Chinese for user-facing outputs
- Console output provides detailed progress information