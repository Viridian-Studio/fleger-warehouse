import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-simple-feature',
  standalone: true,
  template: `
    <section class="page">
      <h1>{{ title }}</h1>
      <div class="data-card">
        <strong>Prepared module</strong>
        <p>This feature has routing and navigation in place for the SaaS MVP roadmap.</p>
      </div>
    </section>
  `,
  styles: `
    .page { display: grid; gap: 18px; }
    h1 { margin: 0; font-size: 28px; }
    p { color: var(--muted); margin: 8px 0 0; }
  `
})
export class SimpleFeatureComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] ?? 'Feature';
}
