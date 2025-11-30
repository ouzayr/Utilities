'use client';

export default function Page() {
  const titles = {
    'resources': 'Resource Management',
    'budget': 'Budget Tracker',
    'risks': 'Risk Register',
    'issues': 'Issue Tracker',
    'time-tracking': 'Time Tracking',
    'documents': 'Document Repository',
    'status': 'Status Dashboard',
    'change-requests': 'Change Request Log',
    'stakeholders': 'Stakeholder Matrix',
    'meetings': 'Meeting Management',
    'quality': 'Quality Management',
    'communications': 'Communication Platform',
    'reports': 'Reporting Tool'
  };

  const descriptions = {
    'resources': 'Allocate team members, track capacity, and manage workload distribution.',
    'budget': 'Monitor project costs, expenses, and financial performance against baseline.',
    'risks': 'Identify, assess, and track project risks and mitigation strategies.',
    'issues': 'Log and manage problems, blockers, and action items requiring resolution.',
    'time-tracking': 'Record hours spent on tasks and activities for billing or analysis.',
    'documents': 'Centralize project documentation, templates, and version control.',
    'status': 'Visualize project health metrics, KPIs, and real-time progress.',
    'change-requests': 'Document and manage scope changes with approval workflows.',
    'stakeholders': 'Map and track stakeholder engagement, communication, and influence.',
    'meetings': 'Schedule meetings, track agendas, minutes, and action items.',
    'quality': 'Track testing, defects, compliance, and quality assurance activities.',
    'communications': 'Enable team collaboration, messaging, and information sharing.',
    'reports': 'Generate status reports, executive summaries, and performance analytics.'
  };

  const dirName = 'reports';

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{titles[dirName]}</h1>
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600 mb-4">{descriptions[dirName]}</p>
        <div className="mt-6 p-4 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            This tool is ready for implementation. All the necessary types, services, and data access layers are in place.
          </p>
        </div>
      </div>
    </div>
  );
}
