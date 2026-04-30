import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard.component').then((m) => m.DashboardComponent) },
  { path: 'repos', loadComponent: () => import('./pages/repos.component').then((m) => m.ReposComponent) },
  { path: 'scans', loadComponent: () => import('./pages/scans.component').then((m) => m.ScansComponent) },
  { path: 'graph', loadComponent: () => import('./pages/graph.component').then((m) => m.GraphComponent) },
  { path: 'flow', loadComponent: () => import('./pages/flow.component').then((m) => m.FlowComponent) },
  { path: 'endpoints', loadComponent: () => import('./pages/endpoints.component').then((m) => m.EndpointsComponent) },
  { path: 'lint', loadComponent: () => import('./pages/lint.component').then((m) => m.LintComponent) },
  { path: 'diff', loadComponent: () => import('./pages/diff.component').then((m) => m.DiffComponent) },
  { path: 'reports', loadComponent: () => import('./pages/reports.component').then((m) => m.ReportsComponent) },
  { path: 'imports', loadComponent: () => import('./pages/imports.component').then((m) => m.ImportsComponent) },
  { path: '**', redirectTo: 'dashboard' },
];
