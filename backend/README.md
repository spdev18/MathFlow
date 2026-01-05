# MathMaster Backend API v1

This is the core backend service for the MathMaster application. It provides an HTTP API for step-by-step math problem solving, hint generation, session management, and student progress reporting.

## Architecture Overview

The backend is built with a modular architecture:

*   **Engine Bridge Adapter (`src/engine`)**: A self-contained module that interfaces with the core math engine (`src/mapmaster`). It handles AST manipulation, rule matching, and step execution.
*   **Step Orchestrator (`src/orchestrator`)**: Coordinates the flow of user interactions. It manages:
    *   **Session History**: Tracks the sequence of steps for undo functionality.
    *   **Policies**: Enforces rules (e.g., "student" vs "teacher.debug").
    *   **Invariants**: Loads course-specific rules and invariant sets.
*   **Session Service (`src/session`)**: In-memory storage for user sessions and history.
*   **Auth Service (`src/auth`)**: Handles user registration, login, and JWT-based authentication with Role-Based Access Control (RBAC).
*   **HTTP Server (`src/server`)**: A thin Express-like wrapper that exposes the Orchestrator functionality via REST endpoints.

## API Reference

### Authentication
*   **POST** `/api/register`
    *   Body: `{ "username": "...", "password": "...", "role": "student" | "teacher" }`
    *   Returns: `{ "token": "..." }`
*   **POST** `/api/login`
    *   Body: `{ "username": "...", "password": "..." }`
    *   Returns: `{ "token": "..." }`

### Step Execution
*   **POST** `/api/step`
    *   Headers: `Authorization: Bearer <token>`
    *   Body: `{ "sessionId": "...", "expressionLatex": "...", "courseId": "default" }`
    *   Returns: `{ "status": "step-applied", "expressionLatex": "..." }`
*   **POST** `/api/undo-step`
    *   Headers: `Authorization: Bearer <token>`
    *   Body: `{ "sessionId": "..." }`
    *   Returns: `{ "status": "undo-complete", "expressionLatex": "..." }`
*   **POST** `/api/hint-request`
    *   Headers: `Authorization: Bearer <token>`
    *   Body: `{ "sessionId": "...", "expressionLatex": "..." }`
    *   Returns: `{ "status": "hint-generated", "hint": "..." }`

### Reporting (Teacher Only)
*   **GET** `/api/teacher/student-progress?userId={id}`
    *   Headers: `Authorization: Bearer <token>` (Must be Teacher)
    *   Returns: `[ { "sessionId": "...", "createdAt": "...", "stepCount": 5 }, ... ]`

## Deployment & Configuration

### Environment Variables
Create a `.env` file in the root directory (see `.env.example`):
```env
PORT=3000
COURSE_FILE_PATH=./config/courses
SECRET_KEY=your_secure_secret_key
```

### Build & Run
*   **Install Dependencies**:
    ```bash
    npm install
    ```
*   **Development Mode**:
    ```bash
    npm run start:dev
    ```
    (Runs on port defined in `.env` or defaults to 4201/4202)
*   **Production Build**:
    ```bash
    npm run build
    npm start
    ```

## Demo Client

A simple HTML/JS client is included to demonstrate the API and DOM-based interactivity.

1.  Ensure the backend is running.
2.  Open `client/index.html` in a web browser.
    *   *Note: You may need to serve it via a local server (e.g., `npx http-server client`) to avoid CORS issues with `file://` protocol.*
3.  The client sends a test expression (`3 + 2/5`) to the backend.
4.  **Interactivity**: Click on any part of the rendered math formula. The client will log the specific DOM element (tag, class, ID) to the console, demonstrating that events are bound directly to the KaTeX-generated HTML.
