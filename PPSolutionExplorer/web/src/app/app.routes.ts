import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/imports/imports.page').then((m) => m.ImportsPage) },
  {
    path: 'imports/:importId',
    loadComponent: () => import('./features/import-detail/import-detail.page').then((m) => m.ImportDetailPage),
  },
  {
    path: 'imports/:importId/flow',
    loadComponent: () => import('./features/flow-viewer/flow-viewer.page').then((m) => m.FlowViewerPage),
  },
  {
    path: 'imports/:importId/search',
    loadComponent: () => import('./features/search/search.page').then((m) => m.SearchPage),
  },
  {
    path: 'imports/:importId/impact',
    loadComponent: () => import('./features/impact/impact.page').then((m) => m.ImpactPage),
  },
  {
    path: 'imports/:importId/inventory',
    loadComponent: () => import('./features/inventory/inventory.page').then((m) => m.InventoryPage),
  },
  { path: 'search', loadComponent: () => import('./features/search/search.page').then((m) => m.SearchPage) },
  { path: 'compare', loadComponent: () => import('./features/compare/compare.page').then((m) => m.ComparePage) },
  { path: 'rules', loadComponent: () => import('./features/rules/rules.page').then((m) => m.RulesPage) },
  { path: 'audit', loadComponent: () => import('./features/audit/audit.page').then((m) => m.AuditPage) },
  { path: '**', redirectTo: '' },
];
