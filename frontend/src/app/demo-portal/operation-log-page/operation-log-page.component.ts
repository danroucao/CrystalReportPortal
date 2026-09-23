import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  MockAuditLogCategory,
  MockAuditLogEntry,
  MockAuditLogService,
  MockAuditLogSource,
} from '../../services/mock-audit-log.service';
import { AuthService } from '../../services/auth.service';
import { PortalPaginationComponent } from '../../shared/portal-pagination.component';

type OperationLogCategoryFilter = MockAuditLogCategory | 'ALL';
type OperationLogSourceFilter = MockAuditLogSource | 'ALL';
type OperationLogSortField = 'OccurredAt' | 'UserId';
type OperationLogSortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-operation-log-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalPaginationComponent],
  templateUrl: './operation-log-page.component.html',
})
export class OperationLogPageComponent {
  readonly PaginationPageSize = 10;
  readonly Auth = inject(AuthService);
  readonly AuditLog = inject(MockAuditLogService);

  OperationLogCategoryFilter: OperationLogCategoryFilter = 'ALL';
  OperationLogSourceFilter: OperationLogSourceFilter = 'ALL';
  OperationLogStartDate = this.ToDateInputValue(this.GetDateDaysAgo(179));
  OperationLogEndDate = this.ToDateInputValue(new Date());
  OperationLogSearchText = '';
  OperationLogCurrentPage = 1;
  OperationLogSortField: OperationLogSortField = 'OccurredAt';
  OperationLogSortDirection: OperationLogSortDirection = 'desc';
  SelectedOperationLog: MockAuditLogEntry | null = null;

  get CanAccessOperationLog(): boolean {
    return this.Auth.HasManagementPermission('OperationLog');
  }

  get OperationLogMaximumDate(): string {
    return this.ToDateInputValue(new Date());
  }

  get FilteredOperationLogs(): readonly MockAuditLogEntry[] {
    const SearchText = this.OperationLogSearchText.trim().toLocaleLowerCase();
    const Direction = this.OperationLogSortDirection === 'asc' ? 1 : -1;
    return this.AuditLog.OperationLogs
      .filter((Entry) => {
        const OccurredDate = Entry.OccurredAt.slice(0, 10);
        const MatchesDate =
          (!this.OperationLogStartDate || OccurredDate >= this.OperationLogStartDate) &&
          (!this.OperationLogEndDate || OccurredDate <= this.OperationLogEndDate);
        const MatchesSearch = !SearchText ||
          `${Entry.UserId} ${Entry.TargetId} ${Entry.IpAddress} ${Entry.Summary}`.toLocaleLowerCase().includes(SearchText);
        return MatchesDate &&
          MatchesSearch &&
          (this.OperationLogCategoryFilter === 'ALL' || Entry.Category === this.OperationLogCategoryFilter) &&
          (this.OperationLogSourceFilter === 'ALL' || Entry.Source === this.OperationLogSourceFilter);
      })
      .sort((Left, Right) => this.OperationLogSortField === 'OccurredAt'
        ? (new Date(Left.OccurredAt).getTime() - new Date(Right.OccurredAt).getTime()) * Direction
        : Left.UserId.localeCompare(Right.UserId, 'zh-Hant') * Direction);
  }

  get OperationLogTotalPages(): number {
    return Math.max(1, Math.ceil(this.FilteredOperationLogs.length / this.PaginationPageSize));
  }

  get OperationLogPageNumbers(): readonly number[] {
    return Array.from({ length: this.OperationLogTotalPages }, (_, Index) => Index + 1);
  }

  get PagedOperationLogs(): readonly MockAuditLogEntry[] {
    const Start = (this.OperationLogCurrentPage - 1) * this.PaginationPageSize;
    return this.FilteredOperationLogs.slice(Start, Start + this.PaginationPageSize);
  }

  OnOperationLogFilterChange(): void { this.OperationLogCurrentPage = 1; }

  OnOperationLogSourceChange(): void {
    if (!this.IsOperationLogFilterCombinationAllowed(this.OperationLogSourceFilter, this.OperationLogCategoryFilter)) {
      this.OperationLogCategoryFilter = 'ALL';
    }
    this.OnOperationLogFilterChange();
  }

  OnOperationLogDateChange(): void {
    if (this.OperationLogEndDate > this.OperationLogMaximumDate) {
      this.OperationLogEndDate = this.OperationLogMaximumDate;
    }
    if (this.OperationLogStartDate && this.OperationLogEndDate && this.OperationLogEndDate < this.OperationLogStartDate) {
      this.OperationLogEndDate = this.OperationLogStartDate;
    }
    this.OnOperationLogFilterChange();
  }

  ToggleOperationLogSort(Field: OperationLogSortField): void {
    this.OperationLogSortDirection = this.OperationLogSortField === Field && this.OperationLogSortDirection === 'asc' ? 'desc' : 'asc';
    this.OperationLogSortField = Field;
  }

  OperationLogSortAria(Field: OperationLogSortField): 'ascending' | 'descending' | 'none' {
    if (this.OperationLogSortField !== Field) return 'none';
    return this.OperationLogSortDirection === 'asc' ? 'ascending' : 'descending';
  }

  GoToOperationLogPage(Page: number): void {
    this.OperationLogCurrentPage = Math.min(Math.max(1, Page), this.OperationLogTotalPages);
  }

  OpenOperationLogDetail(Entry: MockAuditLogEntry): void {
    if (!this.CanAccessOperationLog) return;
    this.SelectedOperationLog = Entry;
  }

  CloseOperationLogDetail(): void { this.SelectedOperationLog = null; }

  OperationLogCategoryLabel(Category: MockAuditLogCategory): string {
    return ({
      PermissionChange: '權限變動',
      ReportAction: '報表操作',
      SystemManagement: '系統管理',
      Authentication: '帳號驗證',
    })[Category];
  }

  OperationLogActionLabel(Action: string): string {
    return ({
      GRANT_ROLE: '授予角色',
      REVOKE_ROLE: '移除角色',
      UPDATE_USER_ROLES: '更新使用者角色',
      UPDATE_ROLE_PERMISSION: '更新角色權限',
      CREATE_ROLE: '新增角色',
      DELETE_ROLE: '刪除角色',
      REPORT_DOWNLOAD: '下載報表',
      REPORT_PREVIEW: '預覽報表',
      REPORT_EXPORT: '匯出報表',
      REPORT_PRINT: '列印報表',
      PARAMETER_CREATE: '新增參數',
      PARAMETER_VIEW: '檢視參數',
      PARAMETER_UPDATE: '更新參數',
      PARAMETER_DELETE: '刪除參數',
      PARAMETER_IMPORT: '匯入參數',
      REPORT_CREATE: '新增報表',
      REPORT_VIEW: '檢視報表',
      REPORT_UPDATE: '更新報表',
      REPORT_DELETE: '刪除報表',
      ROLE_VIEW: '檢視角色',
      ROLE_UPDATE: '更新角色',
      DATABASE_CREATE: '新增資料庫連線',
      DATABASE_VIEW: '檢視資料庫連線',
      DATABASE_UPDATE: '更新資料庫連線',
      DATABASE_DELETE: '刪除資料庫連線',
      DATABASE_TEST_CONNECTION: '測試資料庫連線',
      REPORT_CATEGORY_CREATE: '新增報表分類',
      REPORT_CATEGORY_VIEW: '檢視報表分類',
      REPORT_CATEGORY_UPDATE: '更新報表分類',
      REPORT_CATEGORY_DELETE: '刪除報表分類',
      LOGIN_FAILURE: '登入失敗',
    }[Action] ?? Action);
  }

  OperationLogSourceLabel(Source: MockAuditLogSource): string {
    return Source === 'BackOffice' ? '後台' : '前台';
  }

  FormatOperationLogTime(Value: string): string {
    return new Date(Value).toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  private GetDateDaysAgo(DaysAgo: number): Date {
    const DateValue = new Date();
    DateValue.setDate(DateValue.getDate() - DaysAgo);
    return DateValue;
  }

  private ToDateInputValue(DateValue: Date): string {
    return `${DateValue.getFullYear()}-${String(DateValue.getMonth() + 1).padStart(2, '0')}-${String(DateValue.getDate()).padStart(2, '0')}`;
  }

  private IsOperationLogFilterCombinationAllowed(
    Source: OperationLogSourceFilter,
    Category: OperationLogCategoryFilter,
  ): boolean {
    if (Source === 'ALL' || Category === 'ALL' || Category === 'ReportAction') return true;
    if (Source === 'BackOffice') return Category !== 'Authentication';
    return Category === 'Authentication';
  }
}
