import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, switchMap } from 'rxjs';

import {
  CreateManagedReportRequest,
  ManagedReport,
  ManagedReportCategoryOption,
  ManagedReportDataSourceOption,
} from '../../services/managed-report-api.models';
import { ReportService } from '../../services/report.service';
import { NotificationService } from '../../services/notification.service';
import { PortalPaginationComponent } from '../../shared/portal-pagination.component';
import { ManagedReportReviewDialogComponent } from '../managed-report-review-dialog/managed-report-review-dialog.component';

type SortField = 'reportName' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-managed-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalPaginationComponent, ManagedReportReviewDialogComponent],
  templateUrl: './managed-report-page.component.html',
  styleUrl: './managed-report-page.component.scss',
})
export class ManagedReportPageComponent implements OnInit {
  private readonly reportsApi = inject(ReportService);
  private readonly notifications = inject(NotificationService);

  readonly pageSize = 10;
  reports: readonly ManagedReport[] = [];
  categories: readonly ManagedReportCategoryOption[] = [];
  dataSources: readonly ManagedReportDataSourceOption[] = [];
  searchText = '';
  categoryFilter = 0;
  startDate = '';
  endDate = '';
  currentPage = 1;
  sortField: SortField = 'createdAt';
  sortDirection: SortDirection = 'desc';
  isLoading = false;
  loadError = '';

  isEditorOpen = false;
  isSaving = false;
  editorError = '';
  selectedFile: File | null = null;
  existingDraft: ManagedReport | null = null;
  reviewReport: ManagedReport | null = null;
  draft = this.createEmptyDraft();

  get displayedReports(): readonly ManagedReport[] {
    const search = this.searchText.trim().toLocaleLowerCase();
    const start = this.startDate ? new Date(`${this.startDate}T00:00:00`).getTime() : null;
    const end = this.endDate ? new Date(`${this.endDate}T23:59:59.999`).getTime() : null;
    return [...this.reports]
      .filter((report) =>
        (!this.categoryFilter || report.categoryId === this.categoryFilter) &&
        (!search || `${report.reportCode} ${report.reportName} ${report.description ?? ''}`
          .toLocaleLowerCase().includes(search)) &&
        (start === null || new Date(report.createdAt).getTime() >= start) &&
        (end === null || new Date(report.createdAt).getTime() <= end))
      .sort((left, right) => {
        const direction = this.sortDirection === 'asc' ? 1 : -1;
        if (this.sortField === 'reportName') {
          return left.reportName.localeCompare(right.reportName, 'zh-Hant') * direction;
        }
        const leftTime = new Date(left[this.sortField] ?? 0).getTime();
        const rightTime = new Date(right[this.sortField] ?? 0).getTime();
        return (leftTime - rightTime) * direction;
      });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.displayedReports.length / this.pageSize));
  }

  get pageNumbers(): readonly number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get pagedReports(): readonly ManagedReport[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.displayedReports.slice(start, start + this.pageSize);
  }

  ngOnInit(): void {
    this.loadPage();
  }

  loadPage(): void {
    this.isLoading = true;
    this.loadError = '';
    forkJoin({
      reports: this.reportsApi.GetManagedReports(),
      categories: this.reportsApi.GetManagedReportCategories(),
      dataSources: this.reportsApi.GetManagedReportDataSources(),
    }).pipe(finalize(() => (this.isLoading = false))).subscribe({
      next: ({ reports, categories, dataSources }) => {
        this.reports = reports;
        this.categories = categories;
        this.dataSources = dataSources;
        this.ensurePage();
      },
      error: (error: unknown) => (this.loadError = this.errorMessage(error)),
    });
  }

  openCreate(): void {
    this.existingDraft = null;
    this.draft = this.createEmptyDraft();
    this.selectedFile = null;
    this.editorError = '';
    this.isEditorOpen = true;
  }

  openDraftUpload(report: ManagedReport): void {
    this.existingDraft = report;
    this.draft = {
      reportCode: report.reportCode,
      reportName: report.reportName,
      description: report.description ?? '',
      categoryId: report.categoryId,
      dataSourceId: report.dataSourceId,
      credentialType: 'ReadOnly',
    };
    this.selectedFile = null;
    this.editorError = '';
    this.isEditorOpen = true;
  }

  closeEditor(): void {
    if (this.isSaving) return;
    this.isEditorOpen = false;
    this.existingDraft = null;
    this.selectedFile = null;
    this.editorError = '';
  }

  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    if (file && !file.name.toLocaleLowerCase().endsWith('.rpt')) {
      input.value = '';
      this.selectedFile = null;
      this.editorError = '僅允許上傳 .rpt 報表檔案。';
      return;
    }
    this.selectedFile = file;
    this.editorError = '';
  }

  save(): void {
    const validationError = this.validate();
    if (validationError) {
      this.editorError = validationError;
      return;
    }

    this.isSaving = true;
    this.editorError = '';
    const reportOperation = this.existingDraft
      ? this.reportsApi.UploadRpt(this.existingDraft.reportId, this.selectedFile!)
      : this.reportsApi.CreateManagedReport(this.normalizedDraft()).pipe(
          switchMap((report) => this.reportsApi.UploadRpt(report.reportId, this.selectedFile!)),
        );

    reportOperation.pipe(finalize(() => (this.isSaving = false))).subscribe({
      next: (result) => {
        this.isEditorOpen = false;
        this.notifications.ShowSuccess(
          `RPT 上傳成功，已辨識 ${result.data.parameterCount} 個參數。`,
        );
        this.loadPage();
      },
      error: (error: unknown) => (this.editorError = this.errorMessage(error)),
    });
  }

  setEnabled(report: ManagedReport, isEnabled: boolean): void {
    this.loadError = '';
    this.reportsApi.UpdateManagedReportStatus(report.reportId, isEnabled).subscribe({
      next: (result) => {
        this.notifications.ShowSuccess(result.message);
        this.loadPage();
      },
      error: (error: unknown) => (this.loadError = this.errorMessage(error)),
    });
  }

  deleteReport(report: ManagedReport): void {
    if (!window.confirm(`確定要刪除報表「${report.reportName}」嗎？`)) return;
    this.loadError = '';
    this.reportsApi.DeleteManagedReport(report.reportId).subscribe({
      next: () => {
        this.notifications.ShowSuccess(`報表「${report.reportName}」已刪除。`);
        this.loadPage();
      },
      error: (error: unknown) => (this.loadError = this.errorMessage(error)),
    });
  }

  openReview(report: ManagedReport): void {
    this.reviewReport = report;
  }

  closeReview(): void {
    this.reviewReport = null;
  }

  completeReview(): void {
    this.reviewReport = null;
    this.loadPage();
  }

  setSort(field: SortField): void {
    this.currentPage = 1;
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.sortField = field;
    this.sortDirection = 'asc';
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(1, page), this.totalPages);
  }

  resetPage(): void {
    this.currentPage = 1;
  }

  trackReport(_: number, report: ManagedReport): number {
    return report.reportId;
  }

  statusLabel(report: ManagedReport): string {
    const labels: Record<string, string> = {
      Draft: '草稿',
      PendingConfiguration: '可直接預覽',
      PendingReview: '待確認',
      Ready: '設定完成',
    };
    return labels[report.configurationStatus] ?? report.configurationStatus;
  }

  private validate(): string {
    if (!this.existingDraft && !this.draft.reportCode.trim()) return '請輸入報表代碼。';
    if (!this.draft.reportName.trim()) return '請輸入報表名稱。';
    if (!this.draft.description.trim()) return '請輸入報表說明。';
    if (!this.draft.categoryId) return '請選擇報表分類。';
    if (!this.selectedFile) return '請選擇 RPT 報表檔案。';
    return '';
  }

  private normalizedDraft(): CreateManagedReportRequest {
    return {
      reportCode: this.draft.reportCode.trim(),
      reportName: this.draft.reportName.trim(),
      description: this.draft.description.trim() || null,
      categoryId: this.draft.categoryId,
      dataSourceId: this.draft.dataSourceId || null,
      credentialType: 'ReadOnly',
    };
  }

  private createEmptyDraft(): CreateManagedReportRequest & { description: string } {
    return {
      reportCode: '', reportName: '', description: '', categoryId: 0,
      dataSourceId: null, credentialType: 'ReadOnly',
    };
  }

  private ensurePage(): void {
    this.goToPage(this.currentPage);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return '你沒有執行此報表管理操作的權限。';
      if (typeof error.error?.message === 'string') return error.error.message;
      if (error.status === 409) return '此操作與目前報表狀態衝突。';
      if (typeof error.error?.detail === 'string') return error.error.detail;
      if (error.status === 500) return '後端處理失敗（HTTP 500），請查看 API 服務紀錄。';
    }
    return '報表管理服務暫時無法使用，請稍後再試。';
  }
}
