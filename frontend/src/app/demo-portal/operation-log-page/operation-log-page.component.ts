import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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

interface OperationLogCategoryOption {
  readonly Value: OperationLogCategoryFilter;
  readonly Label: string;
}

@Component({
  selector: 'app-operation-log-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalPaginationComponent],
  templateUrl: './operation-log-page.component.html',
  styleUrl: './operation-log-page.component.scss',
})
export class OperationLogPageComponent implements OnInit {
  readonly PaginationPageSize = 10;
  readonly Auth = inject(AuthService);
  readonly AuditLog = inject(MockAuditLogService);
  readonly OperationLogCategoryOptionsBySource: Readonly<
    Record<OperationLogSourceFilter, readonly OperationLogCategoryOption[]>
  > = {
    ALL: [
      { Value: 'ALL', Label: '全部分類' },
      { Value: 'PermissionChange', Label: '權限異動' },
      { Value: 'ReportAction', Label: '報表操作' },
      { Value: 'AccountManagement', Label: '帳號管理' },
    ],
    BackOffice: [
      { Value: 'ALL', Label: '全部分類' },
      { Value: 'PermissionChange', Label: '權限異動' },
      { Value: 'AccountManagement', Label: '帳號管理' },
    ],
    FrontOffice: [
      { Value: 'ALL', Label: '全部分類' },
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

  ngOnInit(): void {
    this.InitializeOperationLogDateRange();
  }

  get CanAccessOperationLog(): boolean {
    return this.Auth.HasManagementPermission('OperationLog');
  }

  get OperationLogMinimumDate(): string {
    return this.ToDateInputValue(this.GetDateDaysAgo(179));
  }

  get OperationLogMaximumDate(): string {
    return this.ToDateInputValue(new Date());
  }

  get FilteredOperationLogs(): readonly MockAuditLogEntry[] {
    const SearchText = this.OperationLogSearchText.trim().toLocaleLowerCase();
    const FilteredLogs = this.AuditLog.OperationLogs.filter((Entry) => {
      const OccurredDate = Entry.OccurredAt.slice(0, 10);
      const MatchesDate =
        (!this.OperationLogStartDate || OccurredDate >= this.OperationLogStartDate) &&
        (!this.OperationLogEndDate || OccurredDate <= this.OperationLogEndDate);
      const MatchesSearch =
        !SearchText ||
        `${Entry.UserId} ${Entry.TargetId} ${Entry.IpAddress} ${Entry.Summary}`
          .toLocaleLowerCase()
          .includes(SearchText);

      return (
        MatchesDate &&
        MatchesSearch &&
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
    return this.GetTotalPages(this.FilteredOperationLogs.length);
  }

  get OperationLogPageNumbers(): readonly number[] {
    return this.GetPageNumbers(this.OperationLogTotalPages);
  }

  get PagedOperationLogs(): readonly MockAuditLogEntry[] {
    return this.GetPagedItems(
      this.FilteredOperationLogs,
      this.OperationLogCurrentPage,
    );
  }

  OnOperationLogFilterChange(): void {
    if (!this.CanAccessOperationLog) return;
    this.OperationLogCurrentPage = 1;
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
    if (this.OperationLogStartDate < this.OperationLogMinimumDate) {
      this.OperationLogStartDate = this.OperationLogMinimumDate;
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
      this.FilteredOperationLogs.length,
    );
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

  private InitializeOperationLogDateRange(): void {
    this.OperationLogEndDate = this.OperationLogMaximumDate;
    this.OperationLogStartDate = this.ToDateInputValue(this.GetDateDaysAgo(6));
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
}
