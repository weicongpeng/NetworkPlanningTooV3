# AGENTS.md

## Project Overview

Desktop application for telecom network planning (PCI/neighbor/TAC planning, map visualization).

**Tech Stack:**
- **Frontend**: React 18 + TypeScript + Vite + Electron + Tailwind CSS + Zustand + Leaflet
- **Backend**: FastAPI 0.115.0 + Python 3.10+ + Pydantic + Pandas + GeoPandas
- **API**: REST with unified `ApiResponse<T>` format

## Build/Lint/Test Commands

### Frontend (React + TypeScript + Electron)

```bash
cd frontend

# Development
npm run dev              # Start Electron + Vite
npm run dev:web         # Web-only mode (Vite only)
npm run dev:vite        # Vite dev server only (http://localhost:5173)

# Building
npm run build           # Build Vite + Electron
npm run build:vite      # Build Vite only
npm run build:electron  # Compile Electron TypeScript

# Code Quality
npm run lint            # ESLint (checks src/ directory)
npm run type-check      # TypeScript type check (no emit)
```

### Backend (FastAPI + Python)

```bash
cd backend

# Setup (first time)
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Development
python main.py          # Start FastAPI server (http://127.0.0.1:8000)

# Testing
pytest                          # Run all tests
pytest test_distance_threshold.py    # Run single test file
pytest -v                       # Verbose output
pytest -k "test_name"          # Run tests matching pattern
pytest -s                      # Show print output
```

## Code Style Guidelines

### Frontend (TypeScript/React)

**Import Order:**
```typescript
// 1. External libraries
import React from 'react'
import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'

// 2. Internal modules (@/ alias for src/)
import { apiClient } from '@/services/api'
import { useDataStore } from '@/store/dataStore'

// 3. Type imports (always use 'type' keyword)
import type { ApiResponse, DataItem } from '@shared/types'
```

**Component Pattern:** Use functional components with hooks, TypeScript interfaces for props.

**State Management (Zustand):** Use `create<DataState>((set, get) => ({ ... }))` pattern.

**API Service:**
- Regular requests: `apiClient.get()` / `apiClient.post()`
- File upload: `uploadClient.post()` with `FormData`
- File download: `apiClient.get()` with `responseType: 'blob'`, return `response.data`

### Backend (Python/FastAPI)

**Import Order:**
```python
# 1. Standard library
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

# 2. Third-party
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import pandas as pd

# 3. Internal
from app.models.schemas import DataItem
from app.services.data_service import data_service
```

**Encoding Handling (Windows GBK compatibility):**
```python
# Always use GBK-safe encoding for error messages
safe_detail = str(e).encode("gbk", "replace").decode("gbk")
raise HTTPException(status_code=400, detail=safe_detail)
```

**Async Patterns:**
- I/O operations: `async/await`
- CPU-bound pandas/geopandas: `await run_in_threadpool(func, args)`

**Endpoint Pattern:** Use `@router.post()` decorators, return `{"success": True, "data": result}` format.

## Naming Conventions

**Frontend:**
- Components: PascalCase (`DataUploadForm`, `MapPage`)
- Functions/variables: camelCase (`fetchDataList`, `handleSubmit`)
- Constants: UPPER_SNAKE_CASE (`API_BASE_URL`)
- Files: kebab-case (`data-upload-form.tsx`)

**Backend:**
- Classes: PascalCase (`TaskManager`, `DataService`)
- Functions/variables: snake_case (`create_task`, `get_data_by_id`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- Files: snake_case (`task_manager.py`, `data_service.py`)

## Error Handling

**Frontend:** Use try-catch with `error.message`, set error state, console.error.

**Backend:**
```python
try:
    result = await operation()
    return {"success": True, "data": result}
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
```

## Type Safety

**Frontend:** Never use `any` unless absolutely necessary. Use `interface` for props, `type` for utilities.

**Backend:** Use Pydantic for all request/response models. Type hints for all functions. `Optional[T]` for nullables.

## Testing Guidelines

**Backend Test Structure:**
```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_endpoint():
    response = client.get("/api/v1/data/list")
    assert response.status_code == 200
    assert response.json()["success"] is True
```

**Test File Naming:** `test_*.py` in `backend/` or `backend/tests/` directory.

## Key Directories

- `frontend/src/renderer/` - React app source
- `frontend/src/renderer/services/` - API services
- `frontend/src/renderer/store/` - Zustand stores
- `backend/app/api/v1/endpoints/` - API routes
- `backend/app/services/` - Business logic services
- `backend/app/models/` - Pydantic models
- `backend/app/algorithms/` - Algorithm implementations
- `shared/types.ts` - Shared TypeScript types

## Development Workflow

1. Make changes
2. Run type-check: `npm run type-check` (frontend)
3. Run lint: `npm run lint` (frontend)
4. Run tests: `pytest` (backend)
5. Test integration: `npm run dev` (frontend) + `python main.py` (backend)

## Git Commit Messages

**Format**: `type: subject` (max 50 chars)
**Types**: `feat:` / `fix:` / `refactor:` / `docs:` / `test:`

## Important Project-Specific Notes

### Frontend
- **Electron**: Access file paths via `window.electronAPI.getFilePath(file)` when available
- **Colors**: HSL-based custom color variables in Tailwind config
- **Blob downloads**: Use `responseType: 'blob'`, return `response.data` directly

### Backend (CRITICAL for Windows)
- **GBK Encoding**: All string operations must use `.encode("gbk", "replace").decode("gbk")` pattern
- **Async**: Use `run_in_threadpool` for CPU-bound pandas/geopandas operations
- **Paths**: Always use `pathlib.Path` for cross-platform compatibility
- **Print Safety**: main.py wrapper handles encoding; avoid bare print() in endpoints

### Data Processing
- Use `run_in_threadpool` for CPU-intensive pandas/geopandas operations
- Use GeoPandas for spatial operations and Leaflet visualization
- Excel files handled via openpyxl; MapInfo files via GDAL
