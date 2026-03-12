# Architecture Overview

## Storage Layers Clarification

### `server/storage.ts` - **DATABASE Storage Layer (Backend)**
This is the **backend database interface** that the API uses to communicate with PostgreSQL. It's completely necessary and unrelated to browser storage.

**Key Interface Methods:**
- `getTasks()` - Fetch all tasks from database
- `getTask(id)` - Fetch specific task
- `createTask()` - Create new task in database
- `updateTask()` - Update existing task
- `deleteTask()` - Delete task from database
- `getUncompletedPastTasks()` - Fetch overdue tasks

**Used by:** `server/routes.ts` - All API endpoints call these methods

### `client/src/lib/storage.ts` - **React Hook for Client State Management**
This is the client-side React hook that manages application state. It:
- Fetches data from the database via the API (`/api/tasks`)
- Keeps tasks in-memory for fast UI updates
- Calls API methods to persist changes to the database
- **NO browser localStorage** (completely database-driven)

**Key Functions:**
- `useTaskStore()` - React hook that all components use
- Provides: `tasks`, `addTask()`, `updateTask()`, `deleteTask()`, etc.

## Data Flow

```
User Action (UI) 
    ↓
React Component
    ↓
useTaskStore() [client/src/lib/storage.ts]
    ↓
API Request (fetch/POST/PUT/DELETE)
    ↓
Express Routes [server/routes.ts]
    ↓
DatabaseStorage [server/storage.ts]
    ↓
Drizzle ORM
    ↓
PostgreSQL Database
```

## Architecture Summary

- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Frontend**: React 18 + Vite + TanStack Query
- **Storage**: PostgreSQL only (no browser storage)
- **API**: RESTful endpoints at `/api/tasks*`
- **State**: Managed via custom React hook with in-memory cache

## Why Both Files Are Necessary

1. **`server/storage.ts`**: Database abstraction layer (backend)
   - Translates JavaScript/TypeScript calls into SQL queries
   - Manages database connections
   - Handles data validation at the DB layer

2. **`client/src/lib/storage.ts`**: React state management (frontend)
   - Keeps UI in sync with database
   - Handles optimistic updates
   - Manages global state across all components
   - Acts as the API client

Both work together: the client hook calls the API, which uses the database storage interface.
