import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { InventoryComponent } from './features/inventory/inventory.component';
import { EmployeesComponent } from './features/employees/employees.component';
import { VehiclesComponent } from './features/vehicles/vehicles.component';
import { LoginComponent } from './features/login/login.component';
import { ShellComponent } from './layouts/shell.component';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { AssignmentsComponent } from './features/assignments/assignments.component';
import { TeamComponent } from './features/team/team.component';
import { RolesComponent } from './features/roles/roles.component';
import { AuditLogComponent } from './features/audit-log/audit-log.component';
import { SettingsComponent } from './features/settings/settings.component';
import { PlatformAdminComponent } from './features/platform-admin/platform-admin.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'inventory', component: InventoryComponent },
      { path: 'employees', component: EmployeesComponent },
      { path: 'vehicles', component: VehiclesComponent },
      { path: 'assignments', component: AssignmentsComponent },
      { path: 'team', component: TeamComponent },
      { path: 'roles', component: RolesComponent },
      { path: 'audit-log', component: AuditLogComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'platform-admin', component: PlatformAdminComponent }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
