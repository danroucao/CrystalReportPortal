import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';

import { MockReports } from '../mock/mock-reports';
import { AuthService } from '../services/auth.service';

type DemoPortalPage =
  | 'ReportList'
  | 'ReportParameter'
  | 'ReportPreview'
  | 'UserManagement'
  | 'RoleManagement'
  | 'ReportPermission'
  | 'RptManagement'
  | 'ReportParameterSetting'
  | 'DatabaseConnection'
  | 'OperationLog';

@Component({
  selector: 'app-demo-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './demo-portal.component.html',
  styleUrl: './demo-portal.component.scss',
})
export class DemoPortalComponent {
  readonly Auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly Page = this.route.snapshot.data['Page'] as DemoPortalPage;
  readonly Reports = MockReports;
  readonly Categories = [
    '全部',
    ...new Set(MockReports.map((MockReport) => MockReport.Category)),
  ];
  SearchText = '';
  SelectedCategory = '全部';
  MockNotice = '';

  get PageTitle(): string {
    const PageTitles: Readonly<Record<DemoPortalPage, string>> = {
      ReportList: '我的報表',
      ReportParameter: '報表條件',
      ReportPreview: '報表預覽',
      UserManagement: '使用者管理',
      RoleManagement: '角色管理',
      ReportPermission: '報表權限管理',
      RptManagement: 'RPT 報表管理',
      ReportParameterSetting: '報表參數設定',
      DatabaseConnection: 'MSSQL 資料庫連線管理',
      OperationLog: '操作紀錄查詢',
    };
    return PageTitles[this.Page];
  }

  get FilteredReports() {
    const NormalizedSearchText = this.SearchText.trim().toLowerCase();
    return this.Reports.filter(
      (MockReport) =>
        (this.SelectedCategory === '全部' ||
          MockReport.Category === this.SelectedCategory) &&
        (!NormalizedSearchText ||
          `${MockReport.ReportName} ${MockReport.Description}`
            .toLowerCase()
            .includes(NormalizedSearchText)),
    );
  }

  get AdminDescription(): string {
    const Descriptions: Partial<Record<DemoPortalPage, string>> = {
      UserManagement: '檢視使用者帳號、角色與啟用狀態的 Mock 清單。',
      RoleManagement: '檢視角色與角色權限的 Mock 設定。',
      ReportPermission:
        '檢視 CanView、CanExecute、CanExportPdf、CanPrint 的 Mock 權限矩陣。',
      RptManagement: '檢視 RPT 報表名稱、分類與啟用狀態的 Mock 資料。',
      ReportParameterSetting: '檢視 RPT 參數顯示設定的 Mock 資料。',
      DatabaseConnection: '檢視資料庫連線設定畫面；不會顯示或連線真實帳密。',
      OperationLog: '檢視操作紀錄畫面與 180 天 保存標示的 Mock 資料。',
    };
    return Descriptions[this.Page] ?? '';
  }

  SelectReport(): void {
    void this.router.navigate(['/reports/parameters']);
  }

  ExecuteReport(): void {
    void this.router.navigate(['/reports/preview']);
  }

  SelectOutputAction(ActionName: string): void {
    this.MockNotice = `${ActionName} 為前端 Mock 操作，未連接 PDF 或印表機服務。`;
  }

  Logout(): void {
    this.Auth.Logout();
    void this.router.navigate(['/login']);
  }
}
