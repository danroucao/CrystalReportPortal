import { Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { DemoPortalComponent } from './demo-portal/demo-portal.component';
import {
  BackOfficeGuard,
  FrontOfficeGuard,
  FrontOfficePermissionGuard,
  ReportPreviewGuard,
} from './guards/demo-auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    title: '登入｜Crystal Reports 外部報表系統',
  },
  {
    path: 'reports',
    component: DemoPortalComponent,
    canActivate: [FrontOfficeGuard],
    data: { Page: 'ReportList' },
    title: '收藏的報表｜Crystal Reports 外部報表系統',
  },
  {
    path: 'reports/parameters',
    component: DemoPortalComponent,
    canActivate: [FrontOfficeGuard],
    data: { Page: 'ReportParameter' },
    title: '所有報表｜Crystal Reports 外部報表系統',
  },
  {
    path: 'reports/preview',
    component: DemoPortalComponent,
    canActivate: [ReportPreviewGuard],
    data: { Page: 'ReportPreview' },
    title: '報表預覽｜Crystal Reports 外部報表系統',
  },
  {
    path: 'notification-center',
    component: DemoPortalComponent,
    canActivate: [FrontOfficeGuard],
    data: { Page: 'NotificationCenter' },
    title: '通知中心｜Crystal Reports 外部報表系統',
  },
  {
    path: 'admin/users',
    component: DemoPortalComponent,
    canActivate: [BackOfficeGuard],
    data: { Page: 'UserManagement' },
    title: '使用者管理｜Crystal Reports 外部報表系統',
  },
  {
    path: 'report-management/upload',
    component: DemoPortalComponent,
    canActivate: [FrontOfficePermissionGuard],
    data: { Page: 'ReportUpload', Permission: 'RptManagement' },
    title: '上傳報表｜Crystal Reports 外部報表系統',
  },
  {
    path: 'report-management',
    component: DemoPortalComponent,
    canActivate: [FrontOfficePermissionGuard],
    data: { Page: 'RptManagement', Permission: 'RptManagement' },
    title: '報表管理｜Crystal Reports 外部報表系統',
  },
  {
    path: 'database-connections',
    component: DemoPortalComponent,
    canActivate: [FrontOfficePermissionGuard],
    data: { Page: 'DatabaseConnection', Permission: 'DatabaseConnection' },
    title: '資料庫連線｜Crystal Reports 外部報表系統',
  },
  {
    path: 'operation-logs',
    component: DemoPortalComponent,
    canActivate: [FrontOfficePermissionGuard],
    data: { Page: 'OperationLog', Permission: 'OperationLog' },
    title: '操作紀錄｜Crystal Reports 外部報表系統',
  },
  {
    path: 'admin/notification-center',
    component: DemoPortalComponent,
    canActivate: [BackOfficeGuard],
    data: { Page: 'NotificationCenter' },
    title: '通知中心｜Crystal Reports 外部報表系統',
  },
  { path: 'admin/reports', pathMatch: 'full', redirectTo: 'report-management' },
  {
    path: 'admin/database-connections',
    pathMatch: 'full',
    redirectTo: 'database-connections',
  },
  {
    path: 'admin/operation-logs',
    pathMatch: 'full',
    redirectTo: 'operation-logs',
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
