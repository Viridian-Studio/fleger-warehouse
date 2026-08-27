import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { tenantInterceptor } from './app/core/api/tenant.interceptor';
import { authInterceptor } from './app/core/api/api.service';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes), provideHttpClient(withInterceptors([tenantInterceptor, authInterceptor]))]
}).catch((error) => console.error(error));
