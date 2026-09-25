import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import {
  CreateManagedReportRequest,
  ManagedReport,
  ManagedReportCategoryOption,
  ManagedReportCategory,
  ManagedReportDataSourceOption,
  RoleReportPermission,
  ReportColumnHeaderMapping,
} from '../../services/managed-report-api.models';
import { ReportService } from '../../services/report.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
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
  private readonly router = inject(Router);
  readonly Auth = inject(AuthService);

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
  readonly pinnedReportIds = new Set<number>();
  isLoading = false;
  loadError = '';

  isEditorOpen = false;
  isSaving = false;
  editorError = '';
  selectedFile: File | null = null;
  existingDraft: ManagedReport | null = null;
  editorTab: 'basic' | 'permissions' | 'headers' = 'basic';
  headerMappings: ReportColumnHeaderMapping[] = [];
  isHeaderMappingsLoading = false;
  isHeaderMappingsSaving = false;
  headerMappingsError = '';
  reviewReport: ManagedReport | null = null;
  permissionReport: ManagedReport | null = null;
  permissionRows: RoleReportPermission[] = [];
  isPermissionsLoading = false;
  permissionError = '';
  reportPendingDeletion: ManagedReport | null = null;
  deleteError = '';
  deleteNeedsLogin = false;
  isDeleting = false;
  isCategoryManagerOpen = false;
  managedCategories: readonly ManagedReportCategory[] = [];
  categorySearchText = '';
  newCategoryName = '';
  editingCategoryId: number | null = null;
  editingCategoryName = '';
  categoryPendingDeletion: ManagedReportCategory | null = null;
  categoryError = '';
  isCategorySaving = false;
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
        const pinOrder = Number(this.pinnedReportIds.has(right.reportId)) - Number(this.pinnedReportIds.has(left.reportId));
        if (pinOrder !== 0) return pinOrder;
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

  get CanViewReportArchive(): boolean {
    return this.Auth.HasPermission('Report.ViewArchive');
  }

  get ReportManagementMinimumDate(): string | null {
    if (this.CanViewReportArchive) return null;
    const date = new Date();
    date.setDate(date.getDate() - 179);
    return this.toDateInputValue(date);
  }

  get ReportManagementMaximumDate(): string {
    return this.toDateInputValue(new Date());
  }

  ngOnInit(): void {
    this.loadPage();
  }

  loadPage(): void {
    this.isLoading = true;
    this.loadError = '';
    forkJoin({
      reports: this.reportsApi.GetManagedReports({
        fromUtc: this.startDate ? this.toUtcBoundary(this.startDate, false) : undefined,
        toUtc: this.endDate ? this.toUtcBoundary(this.endDate, true) : undefined,
      }),
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

  openCategoryManagement(): void {
    this.isCategoryManagerOpen = true;
    this.categorySearchText = '';
    this.newCategoryName = '';
    this.categoryError = '';
    this.editingCategoryId = null;
    this.categoryPendingDeletion = null;
    this.loadManagedCategories();
  }

  closeCategoryManagement(): void {
    if (this.isCategorySaving) return;
    this.isCategoryManagerOpen = false;
    this.categoryError = '';
    this.editingCategoryId = null;
    this.categoryPendingDeletion = null;
  }

  createCategory(): void {
    const categoryName = this.newCategoryName.trim();
    if (!categoryName) {
      this.categoryError = '請輸入分類名稱。';
      return;
    }
    this.isCategorySaving = true;
    this.categoryError = '';
    this.reportsApi.CreateManagedReportCategory({ categoryName }).pipe(
      finalize(() => (this.isCategorySaving = false)),
    ).subscribe({
      next: () => {
        this.newCategoryName = '';
        this.notifications.ShowSuccess(`已新增報表分類「${categoryName}」。`);
        this.refreshCategoryData();
      },
      error: (error: unknown) => (this.categoryError = this.errorMessage(error)),
    });
  }

  startCategoryEdit(category: ManagedReportCategory): void {
    this.editingCategoryId = category.categoryId;
    this.editingCategoryName = category.categoryName;
    this.categoryError = '';
  }

  cancelCategoryEdit(): void {
    if (this.isCategorySaving) return;
    this.editingCategoryId = null;
    this.editingCategoryName = '';
  }

  saveCategory(category: ManagedReportCategory): void {
    const categoryName = this.editingCategoryName.trim();
    if (!categoryName) {
      this.categoryError = '請輸入分類名稱。';
      return;
    }
    this.isCategorySaving = true;
    this.categoryError = '';
    this.reportsApi.UpdateManagedReportCategory(category.categoryId, { categoryName }).pipe(
      finalize(() => (this.isCategorySaving = false)),
    ).subscribe({
      next: () => {
        this.editingCategoryId = null;
        this.notifications.ShowSuccess(`已更新報表分類為「${categoryName}」。`);
        this.refreshCategoryData();
      },
      error: (error: unknown) => (this.categoryError = this.errorMessage(error)),
    });
  }

  requestCategoryDelete(category: ManagedReportCategory): void {
    this.categoryPendingDeletion = category;
    this.categoryError = '';
  }

  cancelCategoryDelete(): void {
    if (!this.isCategorySaving) this.categoryPendingDeletion = null;
  }

  confirmCategoryDelete(): void {
    const category = this.categoryPendingDeletion;
    if (!category || this.isCategorySaving) return;
    this.isCategorySaving = true;
    this.categoryError = '';
    this.reportsApi.DeleteManagedReportCategory(category.categoryId).pipe(
      finalize(() => (this.isCategorySaving = false)),
    ).subscribe({
      next: () => {
        this.categoryPendingDeletion = null;
        this.notifications.ShowSuccess(`已刪除報表分類「${category.categoryName}」。`);
        this.refreshCategoryData();
      },
      error: (error: unknown) => (this.categoryError = this.errorMessage(error)),
    });
  }

  private refreshCategoryData(): void {
    this.loadManagedCategories();
    this.loadPage();
  }

  private loadManagedCategories(): void {
    this.reportsApi.GetManagedReportCategoriesForManagement().subscribe({
      next: (categories) => (this.managedCategories = categories),
      error: (error: unknown) => (this.categoryError = this.errorMessage(error)),
    });
  }

  openCreate(): void {
    this.existingDraft = null;
    this.permissionReport = null;
    this.permissionRows = [];
    this.permissionError = '';
    this.headerMappings = [];
    this.headerMappingsError = '';
    this.editorTab = 'basic';
    this.draft = this.createEmptyDraft();
    this.selectedFile = null;
    this.editorError = '';
    this.isEditorOpen = true;
  }

  openReportEditor(report: ManagedReport): void {
    this.existingDraft = report;
    this.permissionReport = report;
    this.permissionRows = [];
    this.permissionError = '';
    this.headerMappings = [];
    this.headerMappingsError = '';
    this.editorTab = 'basic';
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
    this.loadReportPermissions(report);
  }

  openDraftUpload(report: ManagedReport): void {
    this.openReportEditor(report);
  }

  closeEditor(): void {
    if (this.isSaving) return;
    this.isEditorOpen = false;
    this.existingDraft = null;
    this.permissionReport = null;
    this.permissionRows = [];
    this.permissionError = '';
    this.headerMappings = [];
    this.headerMappingsError = '';
    this.editorTab = 'basic';
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
      : this.reportsApi.CreateManagedReportWithRpt(
          this.normalizedDraft(),
          this.selectedFile!,
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

  get displayedManagedCategories(): readonly ManagedReportCategory[] {
    const search = this.categorySearchText.trim().toLocaleLowerCase();
    return this.managedCategories.filter((category) =>
      !search || category.categoryName.toLocaleLowerCase().includes(search));
  }

  requestDelete(report: ManagedReport): void {
    this.reportPendingDeletion = report;
    this.deleteError = '';
    this.deleteNeedsLogin = false;
  }

  cancelDelete(): void {
    if (this.isDeleting) return;
    this.reportPendingDeletion = null;
    this.deleteError = '';
    this.deleteNeedsLogin = false;
  }

  confirmDelete(): void {
    const report = this.reportPendingDeletion;
    if (!report || this.isDeleting) return;

    this.isDeleting = true;
    this.deleteError = '';
    this.deleteNeedsLogin = false;
    this.reportsApi.DeleteManagedReport(report.reportId).pipe(
      finalize(() => (this.isDeleting = false)),
    ).subscribe({
      next: () => {
        this.reportPendingDeletion = null;
        this.notifications.ShowSuccess(`已刪除報表「${report.reportName}」。`);
        this.loadPage();
      },
      error: (error: unknown) => {
        this.deleteNeedsLogin = error instanceof HttpErrorResponse && error.status === 401;
        this.deleteError = this.errorMessage(error);
      },
    });
  }

  returnToLogin(): void {
    this.reportPendingDeletion = null;
    void this.router.navigate(['/login'], { queryParams: { state: 'session-expired' } });
  }

  openReview(report: ManagedReport): void {
    this.reviewReport = report;
  }

  closeReview(): void {
    this.reviewReport = null;
  }

  selectEditorTab(tab: 'basic' | 'permissions' | 'headers'): void {
    if (tab === 'permissions' && !this.existingDraft) return;
    this.editorTab = tab;
    if (tab === 'headers' && this.existingDraft) this.loadHeaderMappings(this.existingDraft);
  }

  addHeaderMapping(): void {
    this.headerMappings = [...this.headerMappings, { sourceText: '', displayName: '' }];
  }

  removeHeaderMapping(index: number): void {
    this.headerMappings = this.headerMappings.filter((_, itemIndex) => itemIndex !== index);
  }

  saveHeaderMappings(): void {
    if (!this.existingDraft) return;
    this.isHeaderMappingsSaving = true;
    this.headerMappingsError = '';
    this.reportsApi.SaveManagedReportColumnHeaderMappings(
      this.existingDraft.reportId,
      this.headerMappings,
    ).pipe(finalize(() => (this.isHeaderMappingsSaving = false))).subscribe({
      next: (mappings) => {
        this.headerMappings = [...mappings];
        this.notifications.ShowSuccess('欄位中文名稱已儲存，後續匯出將自動套用。');
      },
      error: (error: unknown) => (this.headerMappingsError = this.errorMessage(error)),
    });
  }

  private loadHeaderMappings(report: ManagedReport): void {
    this.isHeaderMappingsLoading = true;
    this.headerMappingsError = '';
    this.reportsApi.GetManagedReportColumnHeaderMappings(report.reportId).pipe(
      finalize(() => (this.isHeaderMappingsLoading = false)),
    ).subscribe({
      next: (mappings) => (this.headerMappings = mappings.map((mapping) => ({ ...mapping }))),
      error: (error: unknown) => (this.headerMappingsError = this.errorMessage(error)),
    });
  }

  private loadReportPermissions(report: ManagedReport): void {
    this.permissionRows = [];
    this.permissionError = '';
    this.isPermissionsLoading = true;
    this.reportsApi.GetManagedReportPermissions(report.reportId).pipe(
      finalize(() => (this.isPermissionsLoading = false)),
    ).subscribe({
      next: (permissions) => {
        this.permissionRows = permissions.map((permission) => ({ ...permission }));
      },
      error: (error: unknown) => (this.permissionError = this.errorMessage(error)),
    });
  }

  closePermissions(): void {
    if (!this.isPermissionsLoading) this.permissionReport = null;
  }

  setPermissionExecution(permission: RoleReportPermission): void {
    if (!permission.canExecute) {
      permission.canExport = false;
      permission.canPrint = false;
    }
  }

  savePermission(permission: RoleReportPermission): void {
    this.reportsApi.UpdateManagedReportPermission(
      permission.reportId,
      permission.roleId,
      permission,
    ).subscribe({
      next: (updated) => {
        Object.assign(permission, updated);
        this.notifications.ShowSuccess(`角色「${permission.roleName}」的報表權限已更新。`);
      },
      error: (error: unknown) => (this.permissionError = this.errorMessage(error)),
    });
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

  togglePin(report: ManagedReport): void {
    if (this.pinnedReportIds.has(report.reportId)) {
      this.pinnedReportIds.delete(report.reportId);
    } else {
      this.pinnedReportIds.add(report.reportId);
    }
    this.currentPage = 1;
  }

  isPinned(report: ManagedReport): boolean {
    return this.pinnedReportIds.has(report.reportId);
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(1, page), this.totalPages);
  }

  resetPage(): void {
    this.currentPage = 1;
  }

  onReportDateChange(): void {
    const minimum = this.ReportManagementMinimumDate;
    if (minimum && this.startDate && this.startDate < minimum) this.startDate = minimum;
    if (this.endDate > this.ReportManagementMaximumDate) this.endDate = this.ReportManagementMaximumDate;
    if (this.startDate && this.endDate && this.endDate < this.startDate) this.endDate = this.startDate;
    this.resetPage();
    this.loadPage();
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

  private toDateInputValue(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private toUtcBoundary(value: string, endOfDay: boolean): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, endOfDay ? 15 : -8, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)).toISOString();
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
      if (error.status === 401) return '登入憑證已失效，請重新登入後再試一次。';
      if (error.status === 403) return '你沒有執行此報表管理操作的權限。';
      if (typeof error.error?.message === 'string') return error.error.message;
      if (error.status === 409) return '此操作與目前報表狀態衝突。';
      if (typeof error.error?.detail === 'string') return error.error.detail;
      if (error.status === 500) return '後端處理失敗（HTTP 500），請查看 API 服務紀錄。';
    }
    return '報表管理服務暫時無法使用，請稍後再試。';
  }
}
