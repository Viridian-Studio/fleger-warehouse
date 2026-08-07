import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';

export interface ApplicationDetails {
  version: string;
  buildName: string;
  buildNumber: number;
  companyName: string;
}

const FALLBACK_APPLICATION_DETAILS: ApplicationDetails = {
  version: '0.1.0',
  buildName: 'Vulpes Vulpes',
  buildNumber: 1,
  companyName: 'Viridian Studio'
};

@Injectable({ providedIn: 'root' })
export class ApplicationDetailsStore {
  private readonly api = inject(ApiService);
  readonly details = signal<ApplicationDetails>(FALLBACK_APPLICATION_DETAILS);

  load() {
    this.api.get<ApplicationDetails>('/application-details').subscribe({
      next: (details) => this.details.set(details),
      error: () => undefined
    });
  }
}
