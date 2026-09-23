import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OnInit } from '@angular/core';

import {
  MockAuditLogCategory,
  MockAuditLogEntry,
  MockAuditLogService,
  MockAuditLogSource,
} from '../../services/mock-audit-log.service';
import { AuthService } from '../../services/auth.service';
import { PortalPaginationComponent } from '../../shared/portal-pagination.component';
import { AuditLogService } from '../../services/audit-log.service';
import { AuditLogApiItem } from '../../services/audit-log-api.models';

type OperationLogCategoryFilter = MockAuditLogCategory | 'ALL';
type OperationLogSourceFilter = MockAuditLogSource | 'ALL';
type OperationLogSortField = 'OccurredAt' | 'UserId';
type OperationLogSortDirection = 'asc' | 'desc';

interface OperationLogCategoryOption {
  readonly Value: OperationLogCategoryFilter;
  readonly Label: string;
}

@Component({
  selector: 'app-operation-log-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalPaginationComponent],
  templateUrl: './operation-log-page.component.html',
})
export class OperationLogPageComponent implements OnInit {
  readonly PaginationPageSize = 10;
  readonly Auth = inject(AuthService);
  readonly AuditLog = inject(MockAuditLogService);
  private readonly AuditLogApi = inject(AuditLogService);
  readonly OperationLogCategoryOptionsBySource: Readonly<
    Record<OperationLogSourceFilter, readonly OperationLogCategoryOption[]>
  > = {
    ALL: [
      { Value: 'ALL', Label: '全部' },
      { Value: 'PermissionChange', Label: '權限異動' },
      { Value: 'ReportAction', Label: '報表操作' },
      { Value: 'AccountManagement', Label: '帳號管理' },
    ],
    BackOffice: [
      { Value: 'ALL', Label: '全部' },
      { Value: 'PermissionChange', Label: '權限異動' },
      { Value: 'AccountManagement', Label: '帳號管理' },
    ],
    FrontOffice: [
      { Value: 'ALL', Label: '全部' },
      { Value: 'ReportAction', Label: '報表操作' },
    ],
  };

  OperationLogCategoryFilter: OperationLogCategoryFilter = 'ALL';
  OperationLogSourceFilter: OperationLogSourceFilter = 'ALL';
  OperationLogStartDate = '';
  OperationLogEndDate = '';
  OperationLogSearchText = '';
  OperationLogCurrentPage = 1;
  OperationLogSortField: OperationLogSortField = 'OccurredAt';
  OperationLogSortDirection: OperationLogSortDirection = 'desc';
  SelectedOperationLog: MockAuditLogEntry | null = null;
  ApiLogs: MockAuditLogEntry[] = [];
  ApiTotalCount = 0;
  ApiLoadError = '';
  IsApiLoading = false;

  ngOnInit(): void {
    this.LoadOperationLogs();
  }

  LoadOperationLogs(): void {
    if (!this.CanAccessOperationLog) return;
    this.IsApiLoading = true;
    this.ApiLoadError = '';
    this.AuditLogApi.getLogs({
      page: this.OperationLogCurrentPage,
      pageSize: this.PaginationPageSize,
      fromUtc: this.OperationLogStartDate ? `${this.OperationLogStartDate}T00:00:00Z` : undefined,
      toUtc: this.OperationLogEndDate ? `${this.OperationLogEndDate}T23:59:59.999Z` : undefined,
      search: this.OperationLogSearchText.trim() || undefined,
    }).subscribe({
      next: (response) => {
        this.ApiLogs = response.items.map((item) => this.MapApiLog(item));
        this.ApiTotalCount = response.totalCount;
        this.IsApiLoading = false;
      },
      error: (error: unknown) => {
        this.IsApiLoading = false;
        this.ApiLoadError = error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message
          : '目前無法取得操作紀錄。';
      },
    });
  }

  get CanAccessOperationLog(): boolean {
    return this.Auth.HasManagementPermission('OperationLog');
  }

  get CanViewOperationLogArchive(): boolean {
    return this.Auth.HasPermission('AuditLog.ViewArchive');
  }

  get OperationLogMinimumDate(): string | null {
    return this.CanViewOperationLogArchive
      ? null
      : this.ToDateInputValue(this.GetDateDaysAgo(179));
  }

  get OperationLogMaximumDate(): string {
    return this.ToDateInputValue(new Date());
  }

  get FilteredOperationLogs(): readonly MockAuditLogEntry[] {
    const FilteredLogs = this.ApiLogs.filter((Entry) => {
      const OccurredDate = Entry.OccurredAt.slice(0, 10);
      const MatchesDate =
        (!this.OperationLogStartDate || OccurredDate >= this.OperationLogStartDate) &&
        (!this.OperationLogEndDate || OccurredDate <= this.OperationLogEndDate);
      return (
        MatchesDate &&
        (this.OperationLogCategoryFilter === 'ALL' ||
          Entry.Category === this.OperationLogCategoryFilter) &&
        (this.OperationLogSourceFilter === 'ALL' ||
          Entry.Source === this.OperationLogSourceFilter)
      );
    });
    const Direction = this.OperationLogSortDirection === 'asc' ? 1 : -1;

    return [...FilteredLogs].sort((Left, Right) => {
      if (this.OperationLogSortField === 'OccurredAt') {
        return (
          (new Date(Left.OccurredAt).getTime() -
            new Date(Right.OccurredAt).getTime()) *
          Direction
        );
      }

      return Left.UserId.localeCompare(Right.UserId, 'zh-Hant') * Direction;
    });
  }

  get OperationLogAvailableCategoryOptions(): readonly OperationLogCategoryOption[] {
    return this.OperationLogCategoryOptionsBySource[
      this.OperationLogSourceFilter
    ];
  }

  get OperationLogTotalPages(): number {
    return this.GetTotalPages(this.ApiTotalCount);
  }

  get OperationLogPageNumbers(): readonly number[] {
    return this.GetPageNumbers(this.OperationLogTotalPages);
  }

  get PagedOperationLogs(): readonly MockAuditLogEntry[] {
    return this.FilteredOperationLogs;
  }

  OnOperationLogFilterChange(): void {
    if (!this.CanAccessOperationLog) return;
    this.OperationLogCurrentPage = 1;
    this.LoadOperationLogs();
  }

  OnOperationLogSourceChange(): void {
    if (!this.CanAccessOperationLog) return;
    const IsCurrentCategoryAllowed =
      this.OperationLogAvailableCategoryOptions.some(
        (Option) => Option.Value === this.OperationLogCategoryFilter,
      );
    if (!IsCurrentCategoryAllowed) this.OperationLogCategoryFilter = 'ALL';
    this.OnOperationLogFilterChange();
  }

  ToggleOperationLogSort(Field: OperationLogSortField): void {
    if (!this.CanAccessOperationLog) return;
    this.OperationLogSortDirection =
      this.OperationLogSortField === Field
        ? this.OperationLogSortDirection === 'asc'
          ? 'desc'
          : 'asc'
        : 'asc';
    this.OperationLogSortField = Field;
    this.OnOperationLogFilterChange();
  }

  OperationLogSortIndicator(Field: OperationLogSortField): string {
    if (this.OperationLogSortField !== Field) return '↕';
    return this.OperationLogSortDirection === 'asc' ? '↑' : '↓';
  }

  OperationLogSortAria(
    Field: OperationLogSortField,
  ): 'ascending' | 'descending' | 'none' {
    if (this.OperationLogSortField !== Field) return 'none';
    return this.OperationLogSortDirection === 'asc' ? 'ascending' : 'descending';
  }

  OnOperationLogDateChange(): void {
    if (!this.CanAccessOperationLog) return;
    const minimumDate = this.OperationLogMinimumDate;
    if (minimumDate && this.OperationLogStartDate < minimumDate) {
      this.OperationLogStartDate = minimumDate;
    }
    if (this.OperationLogEndDate > this.OperationLogMaximumDate) {
      this.OperationLogEndDate = this.OperationLogMaximumDate;
    }
    if (
      this.OperationLogStartDate &&
      this.OperationLogEndDate &&
      this.OperationLogEndDate < this.OperationLogStartDate
    ) {
      this.OperationLogEndDate = this.OperationLogStartDate;
    }
    this.OnOperationLogFilterChange();
  }

  GoToOperationLogPage(Page: number): void {
    if (!this.CanAccessOperationLog) return;
    this.OperationLogCurrentPage = this.ClampPage(
      Page,
      this.ApiTotalCount,
    );
    this.LoadOperationLogs();
  }

  OpenOperationLogDetail(Entry: MockAuditLogEntry): void {
    if (!this.CanAccessOperationLog) return;
    this.SelectedOperationLog = Entry;
  }

  CloseOperationLogDetail(): void {
    this.SelectedOperationLog = null;
  }

  OperationLogCategoryLabel(Category: MockAuditLogCategory): string {
    return {
      PermissionChange: '權限異動',
      ReportAction: '報表操作',
      AccountManagement: '帳號管理',
    }[Category];
  }

  OperationLogActionLabel(Action: string): string {
    return (
      {
        GRANT_ROLE: '授予角色',
        REVOKE_ROLE: '移除角色',
        UPDATE_ROLE_PERMISSION: '更新權限',
        REPORT_DOWNLOAD: '下載報表',
        REPORT_PREVIEW: '預覽報表',
        REPORT_EXPORT: '匯出報表',
        REPORT_PRINT: '列印報表',
        CREATE_USER: '建立帳號',
        CREATE_FRONT_OFFICE_USER: '新增使用者',
        UPDATE_ROLE: '更新角色權限',
        CREATE_ROLE: '新增角色',
        BACKOFFICE_BINDING: '後台身分綁定',
        BACKOFFICE_SHARED_LOGIN: '後台共用帳號登入',
        BACKOFFICE_OPERATOR_VERIFY: '操作者身分驗證',
        BACKOFFICE_LOGOUT: '後台登出',
        LOGIN: '登入',
        LOGOUT: '登出',
        UPDATE_USER: '更新帳號',
        DISABLE_USER: '停用帳號',
      }[Action] ?? Action
    );
  }

  OperationLogSourceLabel(Source: MockAuditLogSource): string {
    return Source === 'BackOffice' ? '後台' : '前台';
  }

  FormatOperationLogTime(OccurredAt: string): string {
    return new Date(OccurredAt).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private GetDateDaysAgo(DaysAgo: number): Date {
    const DateValue = new Date();
    DateValue.setDate(DateValue.getDate() - DaysAgo);
    return DateValue;
  }

  private ToDateInputValue(DateValue: Date): string {
    const Year = DateValue.getFullYear();
    const Month = String(DateValue.getMonth() + 1).padStart(2, '0');
    const Day = String(DateValue.getDate()).padStart(2, '0');
    return `${Year}-${Month}-${Day}`;
  }

  private GetTotalPages(ItemCount: number): number {
    return Math.max(1, Math.ceil(ItemCount / this.PaginationPageSize));
  }

  private GetPageNumbers(TotalPages: number): readonly number[] {
    return Array.from({ length: TotalPages }, (_, Index) => Index + 1);
  }

  private GetPagedItems<T>(
    Items: readonly T[],
    CurrentPage: number,
  ): readonly T[] {
    const StartIndex = (CurrentPage - 1) * this.PaginationPageSize;
    return Items.slice(StartIndex, StartIndex + this.PaginationPageSize);
  }

  private ClampPage(RequestedPage: number, ItemCount: number): number {
    return Math.min(Math.max(1, RequestedPage), this.GetTotalPages(ItemCount));
  }

  private MapApiLog(item: AuditLogApiItem): MockAuditLogEntry {
    const source: MockAuditLogSource = item.action.startsWith('BACKOFFICE') || item.userId !== null && item.reportId === null
      ? 'BackOffice'
      : 'FrontOffice';
    const isAccountAction = item.action.includes('USER') ||
      item.action.includes('ACCOUNT') ||
      item.action.includes('LOGIN') ||
      item.action.includes('LOGOUT') ||
      item.action.includes('OPERATOR') ||
      item.action.includes('BACKOFFICE');
    const category: MockAuditLogCategory = item.action.includes('ROLE') || item.action.includes('PERMISSION')
      ? 'PermissionChange'
      : isAccountAction
        ? 'AccountManagement'
        : 'ReportAction';
    return {
      Id: item.auditLogId,
      OccurredAt: item.createdAt,
      UserId: item.userName ?? item.userAccount ?? String(item.userId ?? ''),
      Source: source,
      Category: category,
      Action: item.action,
      Summary: item.details ?? item.errorMessage ?? item.result,
      TargetId: item.reportCode ?? (item.reportId ? String(item.reportId) : ''),
      IpAddress: item.ipAddress ?? '-',
      Details: [{ Label: '結果', Value: item.result }, ...(item.errorMessage ? [{ Label: '錯誤', Value: item.errorMessage }] : [])],
    };
  }
}
