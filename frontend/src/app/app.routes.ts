import { Routes } from '@angular/router';

import {
  BackOfficeGuard,
  FrontOfficeGuard,
  FrontOfficePermissionGuard,
  ReportPreviewGuard,
} from './guards/demo-auth.guards';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

const loadLoginComponent = () =>
  import('./login/login.component').then((module) => module.LoginComponent);

const loadDemoPortalComponent = () =>
  import('./demo-portal/demo-portal.component').then(
    (module) => module.DemoPortalComponent,
  );

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: loadLoginComponent,
    title: '登入｜Crystal Reports 外部報表系統',
  },
  {
    path: 'reports',
    loadComponent: loadDemoPortalComponent,
    canActivate: [FrontOfficeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { Page: 'ReportList' },
    title: '收藏的報表｜Crystal Reports 外部報表系統',
  },
  {
    path: 'reports/parameters',
    loadComponent: loadDemoPortalComponent,
    canActivate: [FrontOfficeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { Page: 'ReportParameter' },
    title: '所有報表｜Crystal Reports 外部報表系統',
  },
  {
    path: 'reports/preview',
    loadComponent: loadDemoPortalComponent,
    canActivate: [ReportPreviewGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { Page: 'ReportPreview' },
    title: '報表預覽｜Crystal Reports 外部報表系統',
  },
  {
    path: 'notification-center',
    loadComponent: loadDemoPortalComponent,
    canActivate: [FrontOfficeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { Page: 'NotificationCenter' },
    title: '通知中心｜Crystal Reports 外部報表系統',
  },
  {
    path: 'admin/users',
    loadComponent: loadDemoPortalComponent,
    canActivate: [BackOfficeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { Page: 'UserManagement' },
    title: '使用者管理｜Crystal Reports 外部報表系統',
  },
  {
    path: 'report-management/upload',
    loadComponent: loadDemoPortalComponent,
    canActivate: [FrontOfficePermissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { Page: 'ReportUpload', Permission: 'RptManagement' },
    title: '上傳報表｜Crystal Reports 外部報表系統',
  },
  {
    path: 'report-management/edit/:reportKey',
    loadComponent: loadDemoPortalComponent,
    canActivate: [FrontOfficePermissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { Page: 'ReportEdit', Permission: 'RptManagement' },
    title: '編輯報表｜Crystal Reports 外部報表系統',
  },
  {
    path: 'report-management',
    loadComponent: loadDemoPortalComponent,
    canActivate: [FrontOfficePermissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { Page: 'RptManagement', Permission: 'RptManagement' },
    title: '報表管理｜Crystal Reports 外部報表系統',
  },
  {
    path: 'database-connections',
    loadComponent: loadDemoPortalComponent,
    canActivate: [FrontOfficePermissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { Page: 'DatabaseConnection', Permission: 'DatabaseConnection' },
    title: '資料庫連線｜Crystal Reports 外部報表系統',
  },
  {
    path: 'operation-logs',
    loadComponent: loadDemoPortalComponent,
    canActivate: [FrontOfficePermissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { Page: 'OperationLog', Permission: 'OperationLog' },
    title: '操作紀錄｜Crystal Reports 外部報表系統',
  },
  {
    path: 'admin/notification-center',
    loadComponent: loadDemoPortalComponent,
    canActivate: [BackOfficeGuard],
    canDeactivate: [unsavedChangesGuard],
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
