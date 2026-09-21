import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { AuthService } from '../services/auth.service';
import { MockRbacService } from '../services/mock-rbac.service';

@Component({ standalone: true, template: '<p>Route destination</p>' })
class RoutePage {}

describe('Front/back-office route boundaries', () => {
  let Auth: AuthService;
  let Rbac: MockRbacService;
  let Harness: RouterTestingHarness;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes.map((Route) =>
      Route.component ? { ...Route, component: RoutePage } : Route))] });
    Auth = TestBed.inject(AuthService);
    Rbac = TestBed.inject(MockRbacService);
    Harness = await RouterTestingHarness.create();
  });
  const Url = () => TestBed.inject(Router).url.split('?')[0];

  it('requires authentication for both portals and keeps login public', async () => {
    for (const Path of ['/admin/users', '/operation-logs', '/reports', '/report-management', '/database-connections']) {
      await Harness.navigateByUrl(Path);
      expect(Url()).withContext(Path).toBe('/login');
    }
  });

  it('allows only the back-office pages to a back-office identity', async () => {
    Auth.Login('admin@example.com', 'admin123');
    for (const Path of ['/reports', '/reports/parameters', '/reports/preview', '/account/settings', '/report-management', '/database-connections', '/operation-logs']) {
      await Harness.navigateByUrl(Path);
      expect(Url()).withContext(Path).toBe('/admin/users');
    }
  });

  it('protects each front-office management route, including old URL redirects', async () => {
    Auth.Login('user@example.com', 'user123');
    for (const Path of ['/report-management', '/database-connections', '/operation-logs']) {
      await Harness.navigateByUrl(Path);
      expect(Url()).withContext(Path).toBe(Path);
    }
    await Harness.navigateByUrl('/admin/users');
    expect(Url()).toBe('/reports/parameters');

    Rbac.UpdateRole('FINANCE', { DisplayName: '財務人員', ManagementPermissions: [], Permissions: Rbac.GetEmptyCategoryPermissionEntries() });
    for (const Path of ['/admin/reports', '/admin/database-connections', '/admin/operation-logs', '/operation-logs']) {
      await Harness.navigateByUrl(Path);
      expect(Url()).withContext(Path).toBe('/reports/parameters');
    }
    Rbac.UpdateRole('FINANCE', { DisplayName: '財務人員', ManagementPermissions: ['RptManagement'], Permissions: Rbac.GetEmptyCategoryPermissionEntries() });
    await Harness.navigateByUrl('/admin/reports');
    expect(Url()).toBe('/report-management');
    await Harness.navigateByUrl('/database-connections');
    expect(Url()).toBe('/reports/parameters');
    await Harness.navigateByUrl('/operation-logs');
    expect(Url()).toBe('/reports/parameters');
    Rbac.UpdateRole('FINANCE', { DisplayName: '財務人員', ManagementPermissions: ['OperationLog'], Permissions: Rbac.GetEmptyCategoryPermissionEntries() });
    await Harness.navigateByUrl('/operation-logs');
    expect(Url()).toBe('/operation-logs');
    await Harness.navigateByUrl('/admin/users');
    expect(Url()).toBe('/reports/parameters');
  });

  it('guards direct preview and rechecks the selected report permission', async () => {
    Auth.Login('user@example.com', 'user123');
    await Harness.navigateByUrl('/reports/preview');
    expect(Url()).toBe('/reports/parameters');
    Auth.SelectReport('AccountBalance');
    await Harness.navigateByUrl('/reports/preview');
    expect(Url()).toBe('/reports/preview');
    await Harness.navigateByUrl('/reports');
    Rbac.SaveCategoryPermissions('FINANCE', Rbac.GetEmptyCategoryPermissionEntries());
    await Harness.navigateByUrl('/reports/preview');
    expect(Url()).toBe('/reports/parameters');
  });
});
