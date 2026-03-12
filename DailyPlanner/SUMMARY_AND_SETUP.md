# Task Tracker - Minimalist Journal Experience

This project is a minimalist, physical-journal-inspired task tracker. It features a daily log, a 7-day weekly planner, and an insights dashboard, powered by a robust PostgreSQL backend.

## Features Implemented

1.  **Daily Journal View**: A focused view for the current day's tasks with a clean, serif-typography aesthetic.
2.  **Weekly/Monthly/Yearly Planner**: A multi-view calendar system to plan and review tasks across different time scales (7-day week view, Monthly grid, Yearly overview).
3.  **Insights Dashboard**: Weekly statistics on task completion and productivity rhythm with historical navigation.
4.  **Morning Replan**: A forced modal on app load that requires you to review uncompleted tasks from previous days (Move to Today, Mark Completed, or Cancel).
5.  **Task Details**: Deep-dive into tasks with categories, clients, multiple tags, typed notes, and a **handwriting/drawing canvas** for stylus users.
6.  **Media Attachments**: Ability to take photos or attach images directly to specific tasks.
7.  **Data Persistence**: All data is stored in **PostgreSQL** with a robust Node.js API backend (no browser storage fallback).
8.  **Automatic Backups**: The app automatically generates and downloads a JSON backup of your data whenever you save task details.
9.  **Reschedule History**: The database tracks every time a task was moved to a different date.
10. **Priority System**: Tasks can be assigned priorities (Low, Medium, High, Urgent) with corresponding color-coding (Blue, Orange, Red, Purple) for quick visual identification.

## Technical Specifications

- **Node.js**: v20.19.27 (Standard environment)
- **React**: 18.3.1 (Vite 7.3.0)
- **TypeScript**: 5.6.3
- **Database**: PostgreSQL (via Drizzle ORM 0.39.3)
- **Styling**: Tailwind CSS 4.0+, Shadcn UI (Radix UI primitives)
- **Icons**: Lucide React
- **Charts**: Recharts 2.15.2
- **State Management**: Custom React Persistence Hook (Synced with PostgreSQL)

## Local Setup Guide

Follow these steps to run the application on your local machine after downloading the code.

### Prerequisites

- **Node.js**: Version 20.x or higher.
- **npm**: Version 10.x or higher.
- **PostgreSQL**: A running instance (local or remote).

### 1. Extract and Navigate
Unzip the downloaded code and open your terminal in the root directory of the project.

### 2. Install Dependencies
Run the following command to install all necessary packages:
```bash
npm install
```

### 3. Database Configuration
Create a `.env` file in the root directory and add your PostgreSQL connection string. Note: On Replit, use the Secrets tool. Locally, you must ensure the environment variable is available to your shell (e.g., using `export` or `set`):
```env
DATABASE_URL=postgres://your_user:your_password@localhost:5432/your_db_name
```

If you prefer to use a `.env` file locally, you can use `npx cross-env`:
```bash
npx cross-env DATABASE_URL=your_url npm run dev
```

### 4. Automatic Database Setup
Run the database setup script to automatically initialize the database and create tables if they don't exist:
```bash
npx tsx script/setup-db.ts
```

Alternatively, manually push the schema:
```bash
npm run db:push
```

### 5. Start the Application
Run the development server (starts both the Express backend and Vite frontend):
```bash
npm run dev
```

The application will typically be available at `http://localhost:5173`.

## Docker Setup

To run this application using Docker:

### 1. Build the Docker Image
```bash
docker build -t task-tracker .
```

### 2. Run the Container
You'll need to provide your `DATABASE_URL` as an environment variable:
```bash
docker run -p 5000:5000 -e DATABASE_URL=your_postgres_url task-tracker
```

The app will be available at `http://localhost:5000`.

## Windows Compatibility
If you encounter errors with `npm start` or `npm run dev` on Windows (e.g., "'NODE_ENV' is not recognized as an internal or external command"), you can use `npx cross-env` to handle environment variables cross-platform:
```bash
npx cross-env NODE_ENV=development npm run dev
```

### Known Issue: "Short string in plain HTML"
If the application loads but only displays a short string (like a path or "index.html") instead of the full app, ensure you are using the correct route syntax in `server/vite.ts`. The project has been updated to use a standard catch-all route which is more compatible with local Express environments.

## Data Model (Database Schema)
All data is persisted in PostgreSQL. The task structure follows this schema:
```json
{
  "id": 123,
  "title": "Task Title",
  "completed": false,
  "cancelled": false,
  "date": "2026-03-05",
  "priority": "Medium",
  "category": "Work",
  "client": "Client Name",
  "tags": ["urgent", "important"],
  "notes": "Typed notes here",
  "handwrittenNotes": "data:image/png;base64,...",
  "attachments": [{"url": "...", "name": "image.png"}],
  "rescheduleHistory": ["2026-03-04"],
  "createdAt": "2026-03-05T..."
}
```

## Future Recommendations

### High Priority
- **Real-time Collaboration**: Add WebSocket support to enable multiple users to collaborate on the same task list in real-time.
- **User Authentication & Multi-User Support**: Implement user authentication with Replit Auth or OAuth to support multi-user task tracking (currently all tasks are shared globally).
- **Task Search and Filtering**: Add full-text search and advanced filtering by priority, category, date range, and tags.
- **Recurring Tasks**: Implement task recurrence rules (daily, weekly, monthly) to auto-generate recurring tasks.
- **Analytics & Reporting**: Enhanced insights with charts for productivity trends, task completion rates, and time tracking.

### Medium Priority
- **Dark Mode**: Add full dark mode support with automatic detection of system preferences.
- **Email Notifications**: Send email reminders for overdue tasks or upcoming deadlines.
- **Mobile App**: Build native mobile apps (iOS/Android) using React Native or Flutter for better mobile experience.
- **Offline Sync**: Re-implement local caching (with Service Workers) to enable offline access while maintaining DB as the source of truth.
- **Drag-and-Drop Interface**: Add drag-and-drop for tasks across dates, priorities, and categories.
- **Voice Input**: Add voice-to-text for quick task creation while hands-free.

### Low Priority
- **Themes & Customization**: Allow users to customize colors, fonts, and layout preferences.
- **Keyboard Shortcuts**: Implement global keyboard shortcuts for power users (e.g., `Cmd+K` to create task).
- **Export Options**: Support exporting tasks to CSV, iCal, or other formats.
- **Integration with Calendar Apps**: Sync with Google Calendar, Outlook, or Apple Calendar.
- **AI-Powered Task Suggestions**: Use LLMs to suggest task priorities, deadlines, or subtasks based on task descriptions.
- **Team Features**: Add team workspaces, task assignments, and collaborative notes.

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `psql -U postgres -h localhost`
- Check that DATABASE_URL is correctly formatted: `postgres://user:password@host:port/database`
- On Windows, use `npx cross-env` to set environment variables

### API Not Responding
- Ensure the Express backend is running on port 5000
- Check `npm run dev` output for any error messages
- Verify that PORT environment variable is not conflicting

### Frontend Not Loading
- Clear browser cache or use incognito mode
- Check browser console for JavaScript errors
- Ensure Vite dev server is running (look for output in terminal)

### Tasks Not Persisting
- Verify DATABASE_URL is set and the database is reachable
- Run `npx tsx script/setup-db.ts` to ensure tables are created
- Check server logs for any database errors

## Support & Contribution
For issues or feature requests, please create an issue in the project repository. Contributions are welcome!
