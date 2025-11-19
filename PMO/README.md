# PMO - Project Management Office Solution

A comprehensive, enterprise-grade Project Management Office (PMO) solution built with Next.js, TypeScript, and Tailwind CSS. This application provides 14 integrated tools for complete project portfolio management.

## 🚀 Features

### Core Capabilities

- **Multi-Project Management**: Manage multiple projects across your portfolio
- **Role-Based Access Control (RBAC)**: Granular permissions for Admin, PMO Manager, Project Manager, Team Member, and Stakeholder roles
- **Complete Audit Trail**: Track all changes with detailed audit logs
- **LocalStorage with API Migration Path**: Easy transition from browser storage to backend API
- **Authentication & User Management**: Secure user authentication and profile management
- **Notification System**: Track pending approvals, deadlines, and important updates
- **Export/Import**: Support for CSV, JSON, and Excel formats

### 14 Integrated PMO Tools

1. **Project Scheduling Tool** - Create timelines, set milestones, and track task dependencies
2. **Resource Management Tool** - Allocate team members, track capacity, and manage workload distribution
3. **Budget Tracker** - Monitor project costs, expenses, and financial performance against baseline
4. **Risk Register** - Identify, assess, and track project risks and mitigation strategies
5. **Issue Tracker** - Log and manage problems, blockers, and action items requiring resolution
6. **Time Tracking Tool** - Record hours spent on tasks and activities for billing or analysis
7. **Document Repository** - Centralize project documentation, templates, and version control
8. **Status Dashboard** - Visualize project health metrics, KPIs, and real-time progress
9. **Change Request Log** - Document and manage scope changes with configurable approval workflows
10. **Stakeholder Matrix** - Map and track stakeholder engagement, communication, and influence
11. **Meeting Management Tool** - Schedule meetings, track agendas, minutes, and action items
12. **Quality Management Tool** - Track testing, defects, compliance, and quality assurance activities
13. **Communication Platform** - Enable team collaboration, messaging, and information sharing
14. **Reporting Tool** - Generate status reports, executive summaries, and performance analytics

## 🏗️ Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Charts**: Chart.js & react-chartjs-2
- **Data Export**: XLSX (Excel), CSV, JSON
- **Icons**: Lucide React
- **Date Handling**: date-fns

## 📁 Project Structure

```
PMO/
├── app/                          # Next.js App Router pages
│   ├── auth/                     # Authentication pages
│   │   ├── login/
│   │   └── register/
│   ├── dashboard/                # Main dashboard
│   ├── scheduling/               # Project scheduling tool
│   ├── resources/                # Resource management
│   ├── budget/                   # Budget tracker
│   ├── risks/                    # Risk register
│   ├── issues/                   # Issue tracker
│   ├── time-tracking/            # Time tracking
│   ├── documents/                # Document repository
│   ├── status/                   # Status dashboard
│   ├── change-requests/          # Change request log
│   ├── stakeholders/             # Stakeholder matrix
│   ├── meetings/                 # Meeting management
│   ├── quality/                  # Quality management
│   ├── communications/           # Communication platform
│   └── reports/                  # Reporting tool
├── components/                   # React components
│   ├── layout/                   # Layout components (Sidebar, Header, etc.)
│   ├── common/                   # Reusable UI components
│   ├── charts/                   # Chart components
│   └── forms/                    # Form components
├── lib/                          # Core libraries
│   ├── store/                    # Zustand state stores
│   ├── auth/                     # Authentication logic
│   └── permissions/              # Permission management
├── types/                        # TypeScript type definitions
│   ├── auth.ts
│   ├── project.ts
│   ├── resource.ts
│   ├── budget.ts
│   ├── risk.ts
│   ├── issue.ts
│   ├── time-tracking.ts
│   ├── document.ts
│   ├── change-request.ts
│   ├── stakeholder.ts
│   ├── meeting.ts
│   ├── quality.ts
│   ├── communication.ts
│   ├── report.ts
│   └── common.ts
├── services/                     # Service layer
│   ├── storage/                  # Data access layer
│   │   ├── IDataService.ts       # Interface for data operations
│   │   ├── LocalStorageService.ts# LocalStorage implementation
│   │   ├── ApiService.ts         # API implementation (skeleton)
│   │   └── index.ts              # Service factory
│   ├── api/                      # Business logic services
│   │   ├── authService.ts        # Authentication service
│   │   └── auditService.ts       # Audit trail service
│   └── export/                   # Export/Import service
│       └── exportService.ts
├── hooks/                        # Custom React hooks
└── utils/                        # Utility functions
    └── helpers.ts
```

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Navigate to the PMO directory:
```bash
cd PMO
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Default Login Credentials

```
Email: admin@pmo.com
Password: password
```

## 🔐 Authentication & Authorization

### User Roles

The system supports 5 user roles with different permission levels:

1. **Admin**: Full access to all features and system administration
2. **PMO Manager**: Cross-project view and management capabilities
3. **Project Manager**: Manage assigned projects and teams
4. **Team Member**: Limited access to assigned tasks and time tracking
5. **Stakeholder**: Read-only access to project information

### Permission Scopes

- **All**: Access to all projects and data
- **Own**: Access to own records only
- **Department**: Access to department-level data
- **Project**: Access to specific project data

### Granular Permissions

Each resource supports granular action-based permissions:
- View
- Create
- Edit
- Delete
- Approve
- Export
- Import

## 📊 Data Storage

### LocalStorage (Default)

By default, all data is stored in the browser's localStorage. This allows for:
- No backend setup required
- Instant data persistence
- Easy prototyping and development
- Works offline

### Migrating to API

To switch to API-based data storage:

1. Set environment variable:
```env
NEXT_PUBLIC_USE_API=true
```

2. Implement your API endpoints matching the interface in `services/storage/IDataService.ts`

3. Update the API base URL in `services/storage/ApiService.ts`

The application will automatically use the API service instead of LocalStorage.

## 📈 Dashboards

### Executive Dashboard

Key metrics for leadership:
- Project portfolio health
- Budget performance vs. plan
- High-level risk overview
- Resource utilization across teams
- Strategic KPIs

### Operational Dashboard

Detailed metrics for project teams:
- Daily task completion
- Time tracking by project
- Issue priority distribution
- Risk trends
- Quality metrics

## 🔄 Audit Trail

Every action in the system is logged with:
- User who performed the action
- Timestamp
- Entity type and ID
- Action type (create, update, delete, approve, etc.)
- Changes made (before/after values)
- Additional metadata

Access audit logs through the dedicated audit trail views in each tool.

## 📤 Export/Import

### Supported Formats

- **JSON**: Complete data export with all fields
- **CSV**: Tabular data export
- **Excel**: Multi-sheet workbooks with formatting

### Usage

```typescript
import { ExportService } from '@/services/export/exportService';

// Export to Excel
ExportService.exportToExcel(data, 'projects', 'Projects Sheet');

// Export to CSV
ExportService.exportToCSV(data, 'projects');

// Export to JSON
ExportService.exportToJSON(data, 'projects');

// Import from Excel
const data = await ExportService.importFromExcel(file);
```

## 🔧 Configurable Approval Workflows

The Change Request tool supports configurable multi-step approval workflows:

1. **Create Workflow**: Define approval steps with approvers (by user or role)
2. **Require All or Any**: Configure if all approvers must approve or just one
3. **Add Steps Dynamically**: Add additional approvers during the approval process
4. **Track Status**: Monitor approval progress in real-time

### Workflow Configuration

```typescript
const workflow: ApprovalWorkflow = {
  name: "Standard Change Approval",
  steps: [
    {
      stepNumber: 1,
      name: "Project Manager Review",
      approverType: "role",
      approverRoles: ["project_manager"],
      requireAll: false,
    },
    {
      stepNumber: 2,
      name: "PMO Manager Approval",
      approverType: "role",
      approverRoles: ["pmo_manager"],
      requireAll: true,
    }
  ]
};
```

## 🎨 Customization

### Tailwind Configuration

Modify `tailwind.config.ts` to customize:
- Color schemes
- Typography
- Spacing
- Breakpoints

### Adding New Tools

1. Create types in `types/[tool-name].ts`
2. Add data service endpoints in `services/storage/IDataService.ts`
3. Create store in `lib/store/[tool-name]Store.ts`
4. Build UI in `app/[tool-name]/page.tsx`
5. Add navigation link in `components/layout/Sidebar.tsx`

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop (1920px+)
- Laptop (1024px-1919px)
- Tablet (768px-1023px)
- Mobile (320px-767px)

## 🔒 Security Best Practices

- All user input is validated
- RBAC enforced at the service layer
- Audit trail for accountability
- Session management with expiration
- XSS and injection prevention
- Secure password handling (ready for hashing)

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_USE_API=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

## 📝 Development Guidelines

### Adding a New Feature

1. Define types in `/types`
2. Create service layer in `/services`
3. Build Zustand store in `/lib/store`
4. Implement UI components
5. Add tests (recommended)
6. Update documentation

### Code Style

- Use TypeScript for type safety
- Follow ESLint rules
- Use functional components with hooks
- Implement proper error handling
- Add comments for complex logic

## 🐛 Troubleshooting

### LocalStorage Quota Exceeded

If you encounter localStorage quota issues:
- Clear old data
- Migrate to API-based storage
- Implement data archiving

### Chart Not Rendering

Ensure Chart.js components are registered:
```typescript
import { Chart as ChartJS, ...components } from 'chart.js';
ChartJS.register(...components);
```

## 🤝 Contributing

This is a proprietary PMO solution. For feature requests or bug reports, contact the development team.

## 📄 License

Proprietary and confidential. All rights reserved.

## 🆘 Support

For support, please contact your system administrator or the PMO development team.

---

**Version**: 1.0.0
**Last Updated**: 2025-11-19
**Built with**: Next.js, TypeScript, Tailwind CSS, Chart.js
