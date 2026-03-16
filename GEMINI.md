# Network Planning Tool V3 - Gemini Context

## Project Overview

**Network Planning Tool V3** is a desktop application designed for telecommunications network planning. It integrates a modern React frontend wrapped in Electron with a robust Python (FastAPI) backend for data processing and algorithmic computations.

### Key Capabilities
- **Data Management:** Import/Export and management of Excel engineering parameters.
- **Map Visualization:** Interactive map (Leaflet) for sectors, layers (MapInfo), and neighbor relations.
- **Algorithms:** Intelligent PCI (Physical Cell Identity) planning and collision detection. Neighbor relation planning based on distance and azimuth.
- **Licensing:** Built-in license activation and status management.

## Architecture & Technology Stack

The project follows a decoupled client-server architecture running locally.

### Frontend (`/frontend`)
- **Core:** React 18, TypeScript, Vite
- **Desktop Shell:** Electron 28
- **Styling:** Tailwind CSS, Radix UI Primitives, Lucide Icons
- **State Management:** Zustand
- **Maps:** Leaflet, React-Leaflet
- **Communication:** Axios (calls local backend API)

### Backend (`/backend`)
- **Core:** Python 3.10+, FastAPI, Uvicorn
- **Data Processing:** Pandas, NumPy, OpenPyXL
- **Geospatial:** GeoPandas, Shapely, GDAL
- **API Documentation:** Swagger UI (`/docs`), ReDoc (`/redoc`)

## Development Workflow

### Prerequisites
- **Node.js:** v18+
- **Python:** v3.10+
- **OS:** Windows (preferred for geospatial bin compatibility) or Linux.

### Setup

1.  **Backend Setup:**
    ```bash
    cd backend
    # Create venv (recommended)
    python -m venv venv
    .\venv\Scripts\activate  # Windows
    # source venv/bin/activate # Linux

    # Install dependencies
    pip install -r requirements.txt
    ```

2.  **Frontend Setup:**
    ```bash
    cd frontend
    npm install
    ```

### Running the Application

You typically need two terminals open.

**Terminal 1: Backend**
```powershell
cd backend
python main.py
# Server runs at http://127.0.0.1:8000
```

**Terminal 2: Frontend**
```powershell
cd frontend
npm run dev
# Starts Vite (http://127.0.0.1:5173) and launches the Electron window.
```

## Key Commands

| Category | Command | Description |
| :--- | :--- | :--- |
| **Frontend** | `npm run dev` | Start dev server & Electron |
| | `npm run build` | Build React app and Electron main process |
| | `npm run type-check` | Run TypeScript validation |
| | `npm run lint` | Run ESLint |
| **Backend** | `python main.py` | Start FastAPI server |
| | `pytest` | Run backend unit tests |
| | `black .` | Format Python code |

## Project Structure Highlights

- **`backend/app/`**:
    - `algorithms/`: Core logic for PCI and Neighbor planning.
    - `api/`: FastAPI route definitions.
    - `models/`: Pydantic data models.
    - `services/`: Business logic layer.
- **`frontend/src/`**:
    - `renderer/`: Main React application code.
    - `electron/`: Electron main process code.
- **`uploads/`**: Stores uploaded Excel files (managed by backend).
- **`data/`**: JSON indices or metadata storage.

## Coding Conventions

- **Python:** Follow PEP 8. Use type hints extensively. Handle file encodings (especially for Windows CSV/Excel) carefully.
- **TypeScript:** Strict type checking. Use functional components and Hooks. Prefer Tailwind utility classes over custom CSS.
- **Path Handling:** Always use `pathlib` in Python and `path` module in Node.js to ensure cross-platform compatibility, though the primary target is Windows.
- **Async/Await:** Used extensively in both frontend (API calls) and backend (FastAPI routes).

## Common Tasks & Troubleshooting

- **Encoding Issues:** The backend `main.py` has specific overrides for `print` and `sys.stdout` to handle Windows GBK/UTF-8 encoding issues. Maintain this pattern.
- **Geospatial Libs:** `gdal` and `fiona` can be tricky on Windows. If `pip install` fails, suggest using pre-built `.whl` files from Christoph Gohlke's library or `conda`.
- **Port Conflicts:** Backend defaults to 8000, Frontend to 5173.
