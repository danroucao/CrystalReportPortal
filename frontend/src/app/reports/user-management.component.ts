import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateUserRequest, ManagedUser, RoleOption, UserManagementService } from '../services/user-management.service';
import { PortalLayoutComponent } from './portal-layout.component';

@Component({
  selector: 'app-user-management', standalone: true, imports: [CommonModule, FormsModule, PortalLayoutComponent],
  template: `<app-portal-layout><main class="page"><h1>User management</h1><p class="error" *ngIf="error">{{ error }}</p><form (ngSubmit)="create()"><h2>Create user</h2><input [(ngModel)]="draft.employeeNo" name="employeeNo" placeholder="Employee number" required><input [(ngModel)]="draft.account" name="account" placeholder="Account" required><input [(ngModel)]="draft.userName" name="userName" placeholder="Name" required><input [(ngModel)]="draft.initialPassword" name="password" type="password" placeholder="Initial password" required><label *ngFor="let role of roles"><input type="checkbox" [checked]="draft.roleCodes.includes(role.roleCode)" (change)="toggleRole(role.roleCode, $any($event.target).checked)">{{ role.roleName }}</label><button [disabled]="saving">{{ saving ? 'Saving...' : 'Create user' }}</button></form><h2>Users</h2><table><tr><th>Account</th><th>Name</th><th>Employee no.</th><th>Roles</th><th>Status</th></tr><tr *ngFor="let user of users"><td>{{ user.account }}</td><td>{{ user.userName }}</td><td>{{ user.employeeNo }}</td><td>{{ user.roleCodes.join(', ') }}</td><td>{{ user.isEnabled ? 'Enabled' : 'Disabled' }}</td></tr></table></main></app-portal-layout>`,
  styles: ['.page{max-width:1000px;margin:2rem auto}.page h1{margin-top:0}form{display:grid;gap:.7rem;max-width:500px;padding:1rem;background:#fff;border:1px solid #ddd}input{padding:.5rem}label{display:block}.error{color:#b42318}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:.7rem;text-align:left;border-bottom:1px solid #ddd}button{padding:.6rem 1rem}'],
})
export class UserManagementComponent implements OnInit {
  private readonly api = inject(UserManagementService);
  users: ManagedUser[] = []; roles: RoleOption[] = []; saving = false; error = '';
  draft: CreateUserRequest = { employeeNo: '', account: '', userName: '', initialPassword: '', roleCodes: [], isEnabled: true };
  ngOnInit(): void { this.load(); this.api.getRoles().subscribe({ next: roles => this.roles = roles, error: () => this.error = 'Unable to load roles.' }); }
  load(): void { this.api.getUsers().subscribe({ next: users => this.users = users, error: () => this.error = 'Unable to load users.' }); }
  toggleRole(code: string, checked: boolean): void { this.draft.roleCodes = checked ? [...this.draft.roleCodes, code] : this.draft.roleCodes.filter(x => x !== code); }
  create(): void { this.saving = true; this.error = ''; this.api.createUser(this.draft).subscribe({ next: user => { this.users = [...this.users, user]; this.draft = { employeeNo: '', account: '', userName: '', initialPassword: '', roleCodes: [], isEnabled: true }; this.saving = false; }, error: error => { this.error = error.error?.message ?? 'Unable to create user.'; this.saving = false; } }); }
}