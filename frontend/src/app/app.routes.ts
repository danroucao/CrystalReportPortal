import { Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { DemoPortalComponent } from './demo-portal/demo-portal.component';
import { UserManagementComponent } from './reports/user-management.component';
import { AdminReportManagementComponent } from './reports/admin-report-management.component';
import { DemoAdminGuard, DemoAuthGuard } from './guards/demo-auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    title: '?餃嚚rystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'reports',
    component: DemoPortalComponent,
    canActivate: [DemoAuthGuard],
    data: { Page: 'ReportList' },
    title: '?嗉??銵剁?Crystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'reports/parameters',
    component: DemoPortalComponent,
    canActivate: [DemoAuthGuard],
    data: { Page: 'ReportParameter' },
    title: '?梯”?? / ?梯”璇辣嚚rystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'reports/preview',
    component: DemoPortalComponent,
    canActivate: [DemoAuthGuard],
    data: { Page: 'ReportPreview' },
    title: '?梯”?汗嚚rystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'account/settings',
    component: DemoPortalComponent,
    canActivate: [DemoAuthGuard],
    data: { Page: 'AccountSettings' },
    title: '撣唾?閮剖?嚚rystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'admin/users',
    component: UserManagementComponent,
    canActivate: [DemoAdminGuard],
    title: '雿輻?恣??Crystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'admin/reports',
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: {
      Page: 'RptManagement'
    },
    title: 'RPT 報表管理'
  },
  {
    path: 'admin/database-connections',
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: { Page: 'DatabaseConnection' },
    title: '鞈?摨恍??嚚rystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'admin/operation-logs',
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: { Page: 'OperationLog' },
    title: '??蝝??Crystal Reports 憭?梯”蝟餌絞',
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
