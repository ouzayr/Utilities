# Task Tracker - Project Documentation

## Project Overview
A minimalist, physical-diary-inspired task tracker built with React, Node.js/Express, and PostgreSQL. Features include daily journal view, forced replan modal, 7-day/monthly/yearly planner, insights dashboard, and task priority system with color-coded indicators.

## Key Features
✅ Daily journal view with task management  
✅ Weekly/Monthly/Yearly planner  
✅ Dashboard with insights and statistics  
✅ Task priority system (Low/Medium/High/Urgent)  
✅ Priority color dots (Blue/Orange/Red/Purple)  
✅ Task details modal with notes, attachments, categories  
✅ Morning replan modal for overdue tasks  
✅ PostgreSQL persistence (no browser localStorage)  
✅ Static HTML template version included  
✅ Docker support with auto DB provisioning  

## Database Configuration

### Current Setup
- **Database**: PostgreSQL
- **Connection**: Hardcoded in `server/db.ts` (pool initialization)
- **Location**: User has bypassed environment variable check
- **Status**: ✅ Connected and working (verified via API tests)

### For Production/Docker Deployment
When deploying, pass the connection string as an environment variable:
```bash
# Docker
docker run -e DATABASE_URL="postgresql://user:password@host:port/dbname" ...

# Or in .env file
DATABASE_URL=postgresql://user:password@host:port/dbname
```

## File Structure
```
.
├── client/                 # React frontend
│   └── src/
│       ├── pages/         # Daily, Weekly, Dashboard views
│       ├── components/    # Reusable UI components
│       ├── lib/           # Storage hook, query client
│       └── index.css      # Tailwind styles
├── server/
│   ├── db.ts             # Database pool & Drizzle ORM
│   ├── storage.ts        # Database abstraction layer
│   ├── routes.ts         # API endpoints
│   └── index.ts          # Express server setup
├── shared/
│   └── schema.ts         # Zod schemas & database models
├── templates/            # Static HTML-only version
├── Dockerfile            # Container configuration
└── script/setup-db.ts    # Database auto-provisioning
```

## Important Files & Their Roles
- **server/storage.ts** - Database abstraction layer (NOT browser storage)
- **client/src/lib/storage.ts** - React hook for state management + API calls
- **server/routes.ts** - Express API endpoints with error handling
- **shared/schema.ts** - TypeScript types and Zod validation schemas
- **ARCHITECTURE.md** - Detailed explanation of storage layers

## API Endpoints
- `GET /api/tasks` - Fetch all tasks
- `GET /api/tasks/:id` - Fetch single task
- `GET /api/tasks/past-uncompleted?today=YYYY-MM-DD` - Fetch overdue tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Data Model
```typescript
Task {
  id: number                              // Auto-incremented
  title: string                           // Task title (required)
  date: string                            // YYYY-MM-DD format
  completed: boolean                      // Completion status
  cancelled: boolean                      // Cancellation status
  priority: "Low" | "Medium" | "High" | "Urgent"
  category: string | null
  client: string | null
  tags: string[] | null
  notes: string | null
  handwrittenNotes: string | null         // Canvas drawing as data URI
  attachments: {url, name}[]
  rescheduleHistory: any[]
  createdAt: Date
}
```

## Navigation & Views
- **/** (Home) - Daily journal view with task list
- **/weekly** - Planner with week/month/year views
- **/dashboard** - Insights and statistics
- No authentication required
- No userId filtering (single-user app)

## Styling & Theme
- **Color Palette**: Paper/diary-inspired (warm off-white background)
- **Fonts**: Cormorant Garamond (serif), Montserrat (sans-serif)
- **Priority Dots**: Blue (Low), Orange (Medium), Red (High), Purple (Urgent)
- **CSS Framework**: Tailwind CSS with custom variables
- **UI Components**: shadcn/ui components

## Recent Fixes (March 11, 2026)
- ✅ Fixed error handling for task operations (added try-catch to add/update/delete)
- ✅ Improved error logging in server routes
- ✅ Made handleAddTask async and properly awaited
- ✅ Created ARCHITECTURE.md to clarify storage layers
- ✅ Added static HTML template version in templates/

## Known Limitations
- Single-user application (no authentication)
- No real-time sync with other devices
- Task data stored in PostgreSQL only

## Development Workflow
```bash
# Start the app (Vite + Express dev server)
npm run dev

# Push database migrations
npm run db:push

# Generate database client
npm run db:generate
```

## Docker Deployment
```bash
# Build image
docker build -t task-tracker .

# Run container with database URL
docker run -e DATABASE_URL="postgresql://..." -p 5000:5000 task-tracker
```

## Future Enhancements
- [ ] User authentication (optional, per requirements)
- [ ] Real-time collaboration
- [ ] Mobile app version with Expo
- [ ] Advanced analytics dashboard
- [ ] Task templates and recurring tasks
- [ ] Integration with calendar services

## Notes
- Database connection verified and working (API returning real data)
- All CRUD operations tested and functional
- No localStorage fallback (PostgreSQL-only persistence)
- Static template version available in templates/ folder for offline reference
