'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  AlertTriangle,
  AlertCircle,
  Clock,
  FileText,
  Activity,
  GitPullRequest,
  UserSquare2,
  MessageSquare,
  CheckSquare,
  MessageCircle,
  BarChart3,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Scheduling', href: '/scheduling', icon: Calendar },
  { name: 'Resources', href: '/resources', icon: Users },
  { name: 'Budget', href: '/budget', icon: DollarSign },
  { name: 'Risks', href: '/risks', icon: AlertTriangle },
  { name: 'Issues', href: '/issues', icon: AlertCircle },
  { name: 'Time Tracking', href: '/time-tracking', icon: Clock },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Status', href: '/status', icon: Activity },
  { name: 'Change Requests', href: '/change-requests', icon: GitPullRequest },
  { name: 'Stakeholders', href: '/stakeholders', icon: UserSquare2 },
  { name: 'Meetings', href: '/meetings', icon: MessageSquare },
  { name: 'Quality', href: '/quality', icon: CheckSquare },
  { name: 'Communications', href: '/communications', icon: MessageCircle },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="h-screen w-64 bg-gray-900 text-white flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold">PMO</h1>
        <p className="text-xs text-gray-400 mt-1">Project Management Office</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="space-y-1 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-400 text-center">
          v1.0.0
        </p>
      </div>
    </div>
  );
}
