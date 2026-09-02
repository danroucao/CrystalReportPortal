import { Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { DemoPortalComponent } from './demo-portal/demo-portal.component';
import { DemoAdminGuard, DemoAuthGuard } from './guards/demo-auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    title: '登入｜Crystal Reports 外部報表系統',
  },
  {
    path: 'reports',
    component: DemoPortalComponent,
    canActivate: [DemoAuthGuard],
    data: { Page: 'ReportList' },
    title: '收藏的報表｜Crystal Reports 外部報表系統',
  },
  {
    path: 'reports/parameters',
    component: DemoPortalComponent,
    canActivate: [DemoAuthGuard],
    data: { Page: 'ReportParameter' },
    title: '報表搜尋 / 報表條件｜Crystal Reports 外部報表系統',
  },
  {
    path: 'reports/preview',
    component: DemoPortalComponent,
    canActivate: [DemoAuthGuard],
    data: { Page: 'ReportPreview' },
    title: '報表預覽｜Crystal Reports 外部報表系統',
  },
  {
    path: 'account/settings',
    component: DemoPortalComponent,
    canActivate: [DemoAuthGuard],
    data: { Page: 'AccountSettings' },
    title: '帳號設定｜Crystal Reports 外部報表系統',
  },
  {
    path: 'admin/users',
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: { Page: 'UserManagement' },
    title: '使用者管理｜Crystal Reports 外部報表系統',
  },
  {
    path: 'admin/reports',
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: { Page: 'RptManagement' },
    title: '報表管理｜Crystal Reports 外部報表系統',
  },
  {
    path: 'admin/database-connections',
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: { Page: 'DatabaseConnection' },
    title: '資料庫連線｜Crystal Reports 外部報表系統',
  },
  {
    path: 'admin/operation-logs',
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: { Page: 'OperationLog' },
    title: '操作紀錄｜Crystal Reports 外部報表系統',
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
