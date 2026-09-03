import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <a routerLink="/reports" class="brand">Crystal Reports 外部報表系統</a>
      <div>{{ auth.CurrentUser?.DisplayName }}（{{ auth.ActiveRoleNames }}） <button type="button" (click)="logout()">登出</button></div>
    </header>
    <div class="body">
      <aside class="nav">
        <p>一般使用者功能</p>
        <a routerLink="/reports" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">我的報表</a>
        <a routerLink="/reports/parameters" routerLinkActive="active">報表條件</a>
        <a routerLink="/reports/preview" routerLinkActive="active">報表預覽</a>
        <a routerLink="/account/settings" routerLinkActive="active">帳號設定</a>
        <ng-container *ngIf="auth.IsAdmin">
          <p>管理功能</p>
          <a routerLink="/admin/users" routerLinkActive="active">使用者管理</a>
          <a routerLink="/admin/permissions" routerLinkActive="active">報表權限管理</a>
          <a routerLink="/admin/reports" routerLinkActive="active">RPT 報表管理</a>
          <a routerLink="/admin/parameters" routerLinkActive="active">報表參數設定</a>
          <a routerLink="/admin/database-connections" routerLinkActive="active">MSSQL 資料庫連線管理</a>
          <a routerLink="/admin/operation-logs" routerLinkActive="active">操作紀錄查詢</a>
        </ng-container>
      </aside>
      <section class="content"><ng-content></ng-content></section>
    </div>
  `,
  styles: [`.header{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid #ddd;background:#fff}.brand{font-weight:700;color:#111;text-decoration:none}.header button{margin-left:18px;padding:8px 14px;border:0;border-radius:5px;background:#b71332;color:#fff;font-weight:700}.body{display:flex;min-height:calc(100vh - 59px);background:#fafafa}.nav{width:250px;box-sizing:border-box;padding:24px 8px;border-right:1px solid #ddd;background:#fff}.nav p{margin:0 0 14px;padding:7px 10px;border-left:3px solid #a77a32;color:#8a641f;font-weight:700}.nav p:not(:first-child){margin-top:28px}.nav a{display:block;padding:11px 12px;color:#102a43;text-decoration:none;border-radius:5px}.nav a.active{background:#b71332;color:#fff;font-weight:700}.content{flex:1;padding:28px 32px}@media(max-width:760px){.nav{width:190px}.content{padding:20px 16px}.header{padding:0 12px}}`],
})
export class PortalLayoutComponent {
  readonly auth = inject(AuthService);

  logout(): void {
    this.auth.Logout();
    location.assign('/login');
  }
}
