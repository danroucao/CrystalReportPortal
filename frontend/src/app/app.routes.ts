import { Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { DemoPortalComponent } from './demo-portal/demo-portal.component';
import { ReportListComponent } from './reports/report-list.component';
import { ReportParametersComponent } from './reports/report-parameters.component';
import { DemoAdminGuard, DemoAuthGuard } from './guards/demo-auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    title: '?餃嚚rystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'reports',
    component: ReportListComponent,
    canActivate: [DemoAuthGuard],
    data: { Page: 'ReportList' },
    title: '???梯”嚚rystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'reports/parameters',
    component: ReportParametersComponent,
    canActivate: [DemoAuthGuard],
    data: { Page: 'ReportParameter' },
    title: '?梯”璇辣嚚rystal Reports 憭?梯”蝟餌絞',
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
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: { Page: 'UserManagement' },
    title: '雿輻?恣??Crystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'admin/permissions',
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: { Page: 'ReportPermission' },
    title: '?梯”甈?嚚rystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'admin/reports',
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: { Page: 'RptManagement' },
    title: 'RPT 蝞∠?嚚rystal Reports 憭?梯”蝟餌絞',
  },
  {
    path: 'admin/parameters',
    component: DemoPortalComponent,
    canActivate: [DemoAdminGuard],
    data: { Page: 'ReportParameterSetting' },
    title: '?梯”?閮剖?嚚rystal Reports 憭?梯”蝟餌絞',
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
