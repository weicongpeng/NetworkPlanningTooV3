# Network Planning Tool V3 - Gemini Context

## Project Overview
This project is a comprehensive **Network Planning Tool** designed for telecommunications network management. It features PCI planning, Neighbor planning, and map visualization. The application is built as a hybrid desktop application using **Electron** for the container, **React** for the UI, and **FastAPI** (Python) for the backend logic and data processing.

## Technology Stack

### Frontend
*   **Framework:** React 18 + TypeScript
*   **Build Tool:** Vite
*   **Container:** Electron 28
*   **Styling:** Tailwind CSS + Radix UI
*   **Maps:** Leaflet + React-Leaflet
*   **State Management:** Zustand
*   **HTTP Client:** Axios

### Backend
*   **Framework:** FastAPI
*   **Language:** Python 3.10+
*   **Server:** Uvicorn
*   **Data Processing:** Pandas, NumPy, OpenPyXL
*   **Geospatial:** GeoPandas, Shapely, GDAL
*   **Testing:** Pytest

## Directory Structure

*   **`backend/`**: Python FastAPI application.
    *   `app/`: Core application logic (algorithms, api, models, services).
    *   `main.py`: Entry point for the backend server.
    *   `requirements.txt`: Python dependencies.
    *   `Dockerfile`: Backend container configuration.
*   **`frontend/`**: React + Electron application.
    *   `src/`: Source code (`renderer` for UI, `main` for Electron process).
    *   `electron/`: Electron-specific source files (`main.ts`, `preload.ts`).
    *   `package.json`: Dependencies and scripts.
    *   `vite.config.ts`: Vite configuration.
*   **`scripts/`**: Shell scripts for building and testing.
*   **`start_electron_app.bat`**: Windows batch script to start the full stack development environment.

## Key Commands

### Backend
*   **Install Dependencies:** `pip install -r requirements.txt` (inside `backend/`)
*   **Run Server:** `python main.py` (starts on `http://127.0.0.1:8000`)
*   **Run Tests:** `pytest`
*   **API Docs:** `http://127.0.0.1:8000/docs` (when running)

### Frontend
*   **Install Dependencies:** `npm install` (inside `frontend/`)
*   **Run Web Dev Server:** `npm run dev:vite` (starts on `http://127.0.0.1:5173`)
*   **Run Electron Dev:** `npm run dev` (starts Vite + Electron)
*   **Build:** `npm run build` (builds both Vite and Electron)
*   **Lint:** `npm run lint`

### Full Stack (Windows)
*   **Start All:** Run `start_electron_app.bat` in the root directory. This script:
    1.  Compiles Electron TypeScript.
    2.  Starts the Backend server in a new window.
    3.  Starts the Vite dev server.
    4.  Launches the Electron app.

## Development Workflow & Conventions

1.  **Environment Switching:** The `start_electron_app.bat` script may swap `package.json` with `package.json.electron` to ensure correct dependencies/scripts for the Electron environment. Be aware of this if modifying `package.json` manually.
2.  **API Communication:** The frontend communicates with the backend via HTTP requests to `http://127.0.0.1:8000`. Ensure the backend is running before testing frontend features that require data.
3.  **Geospatial Dependencies:** The backend relies on `GDAL`. Ensure this is correctly installed in the Python environment, as it can be tricky on Windows.
4.  **Testing:**
    *   Backend logic (algorithms, API) should be tested with `pytest`.
    *   Frontend components can be tested with the configured test runner (check `package.json`).

## Architecture Highlights
*   **Hybrid App:** Combines the performance/access of a desktop app (Electron) with the flexibility of a web UI (React).
*   **Data-Heavy:** Heavy lifting (PCI planning, file parsing) is done in Python (Backend) to leverage Pandas/NumPy, while the Frontend focuses on visualization and user interaction.
*   **Map Visualization:** Uses Leaflet for rendering interactive maps of network sectors and neighbors.
