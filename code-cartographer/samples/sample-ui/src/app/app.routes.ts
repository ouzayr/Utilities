import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'orders' },
  { path: 'orders', loadComponent: () => import('./components/order-list.component').then((m) => m.OrderListComponent) },
  { path: 'orders/:id', loadComponent: () => import('./components/order-detail.component').then((m) => m.OrderDetailComponent) },
  { path: 'products', loadComponent: () => import('./components/product-list.component').then((m) => m.ProductListComponent) },
];
