import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';

interface Plan {
  code: string;
  name: string;
  features: string[];
  limits: Record<string, number>;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  template: `
    <section class="page">
      <div class="title-row"><h1>Billing</h1><button (click)="load()">Load plans</button></div>
      <div class="grid">
        @for (plan of plans(); track plan.code) {
          <article class="data-card">
            <strong>{{ plan.name }}</strong>
            <span>{{ plan.code }}</span>
            <small>{{ plan.features.join(', ') }}</small>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    .page { display: grid; gap: 18px; }
    .title-row { display: flex; justify-content: space-between; align-items: center; }
    h1 { margin: 0; font-size: 28px; }
    button { height: 38px; border: 0; border-radius: 8px; padding: 0 14px; background: var(--brand); color: white; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    article { display: grid; gap: 8px; }
    span, small { color: var(--muted); }
    @media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
  `
})
export class BillingComponent {
  private readonly api = inject(ApiService);
  readonly plans = signal<Plan[]>([]);

  constructor() {
    this.load();
  }

  load() {
    this.api.get<Plan[]>('/plans').subscribe({ next: (plans) => this.plans.set(plans) });
  }
}
