import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApplicationDetailsStore } from './core/application/application-details.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <router-outlet />
  `
})
export class AppComponent {
  constructor() {
    inject(ApplicationDetailsStore).load();
  }
}
