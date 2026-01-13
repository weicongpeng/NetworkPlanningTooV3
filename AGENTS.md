# AGENTS.md

Guidelines for agentic coding agents in this repository.

## Project Overview

Desktop application for telecom network planning (map visualization, neighbor/PCI planning). Electron + React + TypeScript frontend, FastAPI + Python backend.

## Build/Lint/Test Commands

### Frontend (React + TypeScript + Electron)
```bash
cd frontend

# Development
npm run dev              # Start Electron + Vite
npm run dev:web         # Web-only mode
npm run dev:vite        # Vite dev server only
npm run dev:electron    # Electron only (requires Vite running)

# Building
npm run build           # Build Vite + Electron
npm run build:vite      # Build Vite only
npm run build:electron  # Compile Electron TypeScript

# Code Quality
npm run lint            # ESLint
npm run type-check      # TypeScript type check
```

### Backend (FastAPI + Python)
```bash
cd backend

# Setup (first time)
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Development
python main.py          # Start FastAPI server (http://127.0.0.1:8000)

# Testing
pytest                          # Run all tests
pytest tests/test_pci_algorithm.py              # Single test file
pytest tests/test_pci_algorithm.py::TestDistanceCalculator::test_haversine_distance  # Single test method
pytest -v                       # Verbose output
pytest --cov=app                # With coverage
```

### Quick Start
```bash
start_app.bat  # Windows: Start all services
```

## Code Style

### Frontend (TypeScript/React)

#### Import Order
```typescript
// 1. External libraries
import React from 'react'
import axios from 'axios'

// 2. Internal modules (@/ alias)
import { dataApi } from '@/services/api'
import { useDataStore } from '@/store/dataStore'

// 3. Type imports (use 'type' keyword)
import type { ApiResponse, DataItem } from '@shared/types'
```

#### Component Pattern
```typescript
interface ComponentProps {
  title: string
  onSubmit: (data: FormData) => void
}

export const Component: React.FC<ComponentProps> = ({ title, onSubmit }) => {
  const [loading, setLoading] = useState(false)
  const { items } = useDataStore()

  const handleSubmit = useCallback((data: FormData) => {
    setLoading(true)
    onSubmit(data)
  }, [onSubmit])

  return <div className="p-4">{/* JSX */}</div>
}
```

#### State Management (Zustand)
```typescript
interface DataState {
  items: DataItem[]
  loading: boolean
  error: string | null
  fetchList: () => Promise<void>
}

export const useDataStore = create<DataState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  fetchList: async () => {
    set({ loading: true, error: null })
    try {
      const response = await dataApi.list()
      set({ items: response.data || [], loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  }
}))
```

#### API Service
```typescript
export const dataApi = {
  getList: async (): Promise<ApiResponse<DataItem[]>> => apiClient.get('/data/list'),
  create: async (item: DataItem): Promise<ApiResponse<DataItem>> => apiClient.post('/data', item)
}
```

### Backend (Python/FastAPI)

#### Import Order
```python
# 1. Standard library
import asyncio
from typing import Dict, Optional, Any

# 2. Third-party
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# 3. Internal
from app.models.schemas import PCIConfig, PCIResult
from app.services.task_manager import task_manager
```

#### Endpoint Pattern
```python
router = APIRouter()

@router.post("/plan")
async def start_pci_planning(config: PCIConfig) -> Dict[str, Any]:
    try:
        task_id = await task_manager.create_pci_task(config)
        return {"success": True, "data": {"taskId": task_id}}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### Pydantic Model
```python
class PCIConfig(BaseModel):
    dataId: str = Field(..., description="数据集ID")
    networkType: NetworkType = Field(..., description="网络类型")
    pciRange: tuple[int, int] = Field(default=(0, 1007), description="PCI范围")
    collisionThreshold: float = Field(default=3.0, description="冲突阈值")
```

### Naming Conventions

#### Frontend
- Components: PascalCase (`DataUploadForm`)
- Functions/variables: camelCase (`fetchDataList`)
- Constants: UPPER_SNAKE_CASE (`API_BASE_URL`)
- Files: kebab-case (`data-upload-form.tsx`)

#### Backend
- Classes: PascalCase (`TaskManager`)
- Functions/variables: snake_case (`create_pci_task`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- Files: snake_case (`task_manager.py`)

### Error Handling

#### Frontend
```typescript
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject({
    success: false,
    message: error.response?.data?.detail || error.message,
    code: error.response?.status
  })
)
```

#### Backend
```python
try:
    result = await operation()
    return {"success": True, "data": result}
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    logger.error(f"Error: {e}")
    raise HTTPException(status_code=500, detail="内部服务器错误")
```

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Electron + Zustand
- **Backend**: FastAPI + Pydantic + asyncio
- **API**: REST with unified `ApiResponse<T>` format
- **State**: Zustand (frontend), singleton services (backend)
- **Types**: Shared in `shared/types.ts`
- **Async**: All planning tasks are async with progress tracking

## Key Directories

- `frontend/src/renderer/` - React app source
- `frontend/src/renderer/services/api.ts` - API client
- `frontend/src/renderer/store/` - Zustand stores
- `backend/app/api/v1/endpoints/` - API endpoints
- `backend/app/services/` - Business logic
- `backend/app/algorithms/` - Planning algorithms
- `shared/types.ts` - Shared TypeScript types

## Development Workflow

1. Make changes
2. Run lint/type-check: `npm run lint && npm run type-check`
3. Run tests: `npm test` (frontend) or `pytest` (backend)
4. Test integration with dev servers
5. Build: `npm run build`

Follow existing patterns and conventions!
