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
  OperationLogStartDate = this.ToDateInputValue(this.GetDateDaysAgo(6));
  OperationLogEndDate = this.ToDateInputValue(new Date());
  OperationLogSearchText = '';
  IncludeArchivedOperationLogs = false;
  OperationLogCurrentPage = 1;
  OperationLogSortField: OperationLogSortField = 'OccurredAt';
  OperationLogSortDirection: OperationLogSortDirection = 'desc';
  SelectedOperationLog: MockAuditLogEntry | null = null;

  get CanAccessOperationLog(): boolean {
    return this.Auth.HasManagementPermission('OperationLog');
  }

  get CanAccessArchivedOperationLogs(): boolean {
    return this.CanAccessOperationLog && this.Auth.HasManagementPermission('ArchivedOperationLog');
  }

  get OperationLogMinimumDate(): string {
    return this.IncludeArchivedOperationLogs ? '' : this.ToDateInputValue(this.GetDateDaysAgo(179));
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
          (!Entry.ArchivedAt || this.IncludeArchivedOperationLogs) &&
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
    if (this.OperationLogSourceFilter === 'FrontOffice' && this.OperationLogCategoryFilter === 'PermissionChange') {
      this.OperationLogCategoryFilter = 'ALL';
    }
    if (this.OperationLogSourceFilter === 'BackOffice' && this.OperationLogCategoryFilter === 'ReportAction') {
      this.OperationLogCategoryFilter = 'ALL';
    }
    this.OnOperationLogFilterChange();
  }

  OnIncludeArchivedOperationLogsChange(): void {
    if (!this.CanAccessArchivedOperationLogs) {
      this.IncludeArchivedOperationLogs = false;
      return;
    }
    this.OnOperationLogDateChange();
  }

  OnOperationLogDateChange(): void {
    if (!this.IncludeArchivedOperationLogs && this.OperationLogStartDate < this.OperationLogMinimumDate) {
      this.OperationLogStartDate = this.OperationLogMinimumDate;
    }
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
    if (!this.CanAccessOperationLog || (Entry.ArchivedAt && !this.CanAccessArchivedOperationLogs)) return;
    this.SelectedOperationLog = Entry;
  }

  CloseOperationLogDetail(): void { this.SelectedOperationLog = null; }

  OperationLogCategoryLabel(Category: MockAuditLogCategory): string {
    return Category === 'PermissionChange' ? '權限變動' : '報表操作';
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
}
