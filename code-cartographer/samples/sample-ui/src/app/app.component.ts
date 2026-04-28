import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <nav>
      <a routerLink="/orders">Orders</a> |
      <a routerLink="/products">Products</a>
    </nav>
    <router-outlet />
  `,
})
export class AppComponent {}
