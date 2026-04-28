import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'cc-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <header class="topbar">
        <h1>code-cartographer</h1>
        <a class="tab" routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a class="tab" routerLink="/repos" routerLinkActive="active">Repos</a>
        <a class="tab" routerLink="/scans" routerLinkActive="active">Scans</a>
        <a class="tab" routerLink="/graph" routerLinkActive="active">Graph</a>
        <a class="tab" routerLink="/flow" routerLinkActive="active">Flow</a>
        <a class="tab" routerLink="/endpoints" routerLinkActive="active">Endpoints</a>
        <a class="tab" routerLink="/lint" routerLinkActive="active">Lint</a>
        <a class="tab" routerLink="/diff" routerLinkActive="active">Diffs</a>
        <a class="tab" routerLink="/reports" routerLinkActive="active">Reports</a>
        <a class="tab" routerLink="/imports" routerLinkActive="active">Imports</a>
        <span class="spacer"></span>
      </header>
      <main class="main">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {}
