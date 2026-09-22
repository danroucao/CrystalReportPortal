import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { MockReportCategory } from '../../mock/mock-report-categories';
import { MockReportKey, MockReportReadModel } from '../../mock/mock-reports';
import { AuthService } from '../../services/auth.service';
import { MockNotificationCenterService } from '../../services/mock-notification-center.service';
import { MockRbacService } from '../../services/mock-rbac.service';
import { NotificationService } from '../../services/notification.service';
import { MockManagedReportParameterService } from '../../services/mock-managed-report-parameter.service';
import { PortalPaginationComponent } from '../../shared/portal-pagination.component';
import { PortalTab, PortalTabsComponent } from '../../shared/portal-tabs.component';
import { UnsavedChangesDialogComponent } from '../../shared/unsaved-changes-dialog.component';
import { ReportEditorFormComponent } from '../report-editor-form/report-editor-form.component';
import { ReportEditorDraft } from '../report-editor-form/report-editor-form.model';
import { ReportParameterManagementComponent } from '../report-parameter-management/report-parameter-management.component';
import { CommonParameterManagementComponent } from '../common-parameter-management/common-parameter-management.component';

type ReportManagementSortField = 'ReportName' | 'CreatedAt' | 'UpdatedAt';
type ReportManagementSortDirection = 'asc' | 'desc';

/**
 * Owns the report-management screen and its modal workflows.  It deliberately
 * keeps the former public method names so existing portal tests can address the
 * component instance after the parent template is migrated.
 */
@Component({
  selector: 'app-report-management-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PortalPaginationComponent,
    PortalTabsComponent,
    ReportEditorFormComponent,
    ReportParameterManagementComponent,
    CommonParameterManagementComponent,
    UnsavedChangesDialogComponent,
  ],
  templateUrl: './report-management-page.component.html',
  styleUrl: './report-management-page.component.scss',
})
export class ReportManagementPageComponent implements OnInit {
  readonly PaginationPageSize = 10;
  readonly AllCategoryFilterValue = 'ALL';
  readonly Auth = inject(AuthService);
  readonly MockRbac = inject(MockRbacService);
  readonly Notifications = inject(NotificationService);
  readonly NotificationCenter = inject(MockNotificationCenterService);
  readonly ManagedParameters = inject(MockManagedReportParameterService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @Input() isDetailPage = false;

  ReportManagementStartDate = '';
  ReportManagementEndDate = '';
  ReportManagementDateNotice = '';
  ReportManagementCategoryId = this.AllCategoryFilterValue;
  ReportManagementSearchText = '';
  ReportManagementSortField: ReportManagementSortField | null = null;
  ReportManagementSortDirection: ReportManagementSortDirection = 'asc';
  ReportManagementCurrentPage = 1;
  ManagementTab: 'reports' | 'common-parameters' = 'reports';
  readonly ManagementTabs: readonly PortalTab[] = [
    { id: 'reports', label: '報表清單' },
    { id: 'common-parameters', label: '共用參數管理' },
  ];
  private readonly PinnedReportManagementKeys = new Set<MockReportKey>();
  @ViewChild(CommonParameterManagementComponent)
  private commonParameterManagement?: CommonParameterManagementComponent;
  @ViewChild(ReportParameterManagementComponent)
  private reportParameterManagement?: ReportParameterManagementComponent;

  IsCategoryManagementDialogOpen = false;
  IsCategoryDiscardConfirmationOpen = false;
  NewCategoryName = '';
  CategoryCreateError = '';
  EditingCategoryId: string | null = null;
  EditingCategoryName = '';
  private InitialEditingCategoryName = '';
  CategoryEditError = '';
  DeletingCategory: MockReportCategory | null = null;
  CategoryDeleteError = '';

  IsUploadReportDialogOpen = false;
  IsReportDiscardConfirmationOpen = false;
  IsReportCategoryQuickAddOpen = false;
  QuickAddCategoryName = '';
  QuickAddCategoryError = '';
  EditingReportKey: MockReportKey | null = null;
  DeletingReport: MockReportReadModel | null = null;
  ReportEditorDraft: ReportEditorDraft = this.CreateReportEditorDraft();
  SelectedReportFileName = '';
  ReportEditorError = '';
  IsReportFileInvalid = false;
  ReportEditorTab: 'basic' | 'parameters' = 'basic';
  DetectedParameterNames: readonly string[] = [];
  private ReportEditorInitialDraft: ReportEditorDraft | null = null;
  private InitialReportFileName = '';

  ngOnInit(): void {
    if (!this.isDetailPage) return;
    const ReportKey = this.route.snapshot.paramMap.get('reportKey') as MockReportKey | null;
    if (!ReportKey || !this.LoadReportDetail(ReportKey)) {
      void this.router.navigate(['/report-management']);
    }
  }

  get ReportManagementCategories(): readonly MockReportCategory[] {
    return this.MockRbac.GetReportManagementCategories();
  }

  get CategoryManagementCategories(): readonly MockReportCategory[] {
    const Categories = this.MockRbac.GetCategories();
    return [
      ...Categories.filter((Category) => !Category.IsSystemReserved),
      ...Categories.filter((Category) => Category.IsSystemReserved),
    ];
  }

  get ReportEditorCategories(): readonly MockReportCategory[] {
    return this.MockRbac.GetReportEditorCategories(
      this.ReportEditorDraft.CategoryId,
    );
  }

  get DisplayedManagedReports(): readonly MockReportReadModel[] {
    const SearchText = this.ReportManagementSearchText.trim().toLocaleLowerCase();
    const PinPositions = new Map(
      [...this.PinnedReportManagementKeys].map((ReportKey, Index) => [
        ReportKey,
        Index,
      ]),
    );
    const Reports = this.MockRbac.Reports.filter(
      (Report) =>
        (this.ReportManagementCategoryId === this.AllCategoryFilterValue ||
          Report.CategoryId === this.ReportManagementCategoryId) &&
        (!SearchText ||
          `${Report.ReportName} ${Report.Description}`
            .toLocaleLowerCase()
            .includes(SearchText)),
    );
    return [...Reports].sort((Left, Right) => {
      const LeftPinPosition = PinPositions.get(Left.ReportKey) ?? -1;
      const RightPinPosition = PinPositions.get(Right.ReportKey) ?? -1;
      if (LeftPinPosition !== RightPinPosition) {
        if (LeftPinPosition < 0) return 1;
        if (RightPinPosition < 0) return -1;
        return RightPinPosition - LeftPinPosition;
      }
      if (!this.ReportManagementSortField) return 0;

      const Direction = this.ReportManagementSortDirection === 'asc' ? 1 : -1;
      if (this.ReportManagementSortField === 'ReportName') {
        return Left.ReportName.localeCompare(Right.ReportName, 'zh-Hant') * Direction;
      }
      const Field = this.ReportManagementSortField;
      return (new Date(Left[Field]).getTime() - new Date(Right[Field]).getTime()) * Direction;
    });
  }

  get ReportManagementTotalPages(): number {
    return Math.max(1, Math.ceil(this.DisplayedManagedReports.length / this.PaginationPageSize));
  }

  get ReportManagementPageNumbers(): readonly number[] {
    return Array.from({ length: this.ReportManagementTotalPages }, (_, Index) => Index + 1);
  }

  get PagedManagedReports(): readonly MockReportReadModel[] {
    const StartIndex = (this.ReportManagementCurrentPage - 1) * this.PaginationPageSize;
    return this.DisplayedManagedReports.slice(StartIndex, StartIndex + this.PaginationPageSize);
  }

  SetReportEnabled(ReportKey: MockReportKey, Enabled: boolean): void {
    if (!this.HasReportManagementPermission()) return;
    this.MockRbac.SetReportEnabled(ReportKey, Enabled);
    this.ShowSuccessToast(Enabled ? '報表已在 Mock 資料中啟用。' : '報表已在 Mock 資料中停用。');
  }

  TrackReportByKey(_: number, Report: MockReportReadModel): MockReportKey {
    return Report.ReportKey;
  }

  OnReportManagementSearchChange(): void {
    this.ResetReportManagementPagination();
  }

  IsReportManagementPinned(ReportKey: MockReportKey): boolean {
    return this.PinnedReportManagementKeys.has(ReportKey);
  }

  ToggleReportManagementPin(ReportKey: MockReportKey): void {
    if (!this.HasReportManagementPermission()) return;
    if (this.PinnedReportManagementKeys.has(ReportKey)) {
      this.PinnedReportManagementKeys.delete(ReportKey);
    } else {
      this.PinnedReportManagementKeys.add(ReportKey);
    }
    this.ResetReportManagementPagination();
  }

  ToggleReportManagementSort(Field: ReportManagementSortField): void {
    this.ResetReportManagementPagination();
    if (this.ReportManagementSortField === Field) {
      this.ReportManagementSortDirection = this.ReportManagementSortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.ReportManagementSortField = Field;
    this.ReportManagementSortDirection = 'asc';
  }

  GetReportManagementSortIndicator(Field: ReportManagementSortField): '↕' | '↑' | '↓' {
    if (this.ReportManagementSortField !== Field) return '↕';
    return this.ReportManagementSortDirection === 'asc' ? '↑' : '↓';
  }

  GetReportManagementAriaSort(Field: ReportManagementSortField): 'none' | 'ascending' | 'descending' {
    if (this.ReportManagementSortField !== Field) return 'none';
    return this.ReportManagementSortDirection === 'asc' ? 'ascending' : 'descending';
  }

  SetReportManagementCategory(CategoryId: string): void {
    this.ReportManagementCategoryId = CategoryId;
    this.ResetReportManagementPagination();
  }

  GoToReportManagementPage(Page: number): void {
    this.ReportManagementCurrentPage = Math.min(
      Math.max(1, Page),
      this.ReportManagementTotalPages,
    );
  }

  OnReportManagementDateChange(): void {
    this.ResetReportManagementPagination();
    this.ReportManagementDateNotice = '';
    if (!this.ReportManagementStartDate || !this.ReportManagementEndDate) return;
    if (this.ReportManagementEndDate < this.ReportManagementStartDate) {
      this.ReportManagementEndDate = this.ReportManagementStartDate;
      this.ReportManagementDateNotice = '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。';
    }
  }

  OpenCategoryManagementDialog(): void {
    if (!this.HasReportManagementPermission()) return;
    this.NewCategoryName = '';
    this.CategoryCreateError = '';
    this.CancelCategoryEdit();
    this.CategoryDeleteError = '';
    this.IsCategoryManagementDialogOpen = true;
  }

  CloseCategoryManagementDialog(): void {
    this.IsCategoryDiscardConfirmationOpen = false;
    this.IsCategoryManagementDialogOpen = false;
    this.NewCategoryName = '';
    this.CategoryCreateError = '';
    this.CancelCategoryEdit();
    this.CategoryDeleteError = '';
  }

  get OriginalReportFileName(): string {
    return this.InitialReportFileName;
  }

  RequestCloseCategoryManagementDialog(): void {
    if (this.IsCategoryManagementDirty()) {
      this.IsCategoryDiscardConfirmationOpen = true;
      return;
    }
    this.CloseCategoryManagementDialog();
  }

  ContinueEditingCategoryManagement(): void {
    this.IsCategoryDiscardConfirmationOpen = false;
  }

  DiscardCategoryManagementChanges(): void {
    this.CloseCategoryManagementDialog();
  }

  CreateManagedCategory(): void {
    if (!this.HasReportManagementPermission()) return;
    const Result = this.MockRbac.CreateCategory(this.NewCategoryName);
    const Messages = {
      'invalid-name': '請輸入分類名稱。',
      'duplicate-name': '分類名稱已存在，請使用其他名稱。',
      'system-reserved-name': '此名稱為系統保留分類，不可建立。',
    } as const;
    if (Result.Status !== 'created') {
      this.CategoryCreateError = Messages[Result.Status];
      return;
    }
    this.NewCategoryName = '';
    this.CategoryCreateError = '';
    this.NotifyCategoryReview(Result.Category);
    this.ShowSuccessToast(`新增報表分類「${Result.Category.CategoryName}」成功！`);
  }

  StartCategoryEdit(Category: MockReportCategory): void {
    if (!this.HasReportManagementPermission() || Category.IsSystemReserved) return;
    this.EditingCategoryId = Category.CategoryId;
    this.EditingCategoryName = Category.CategoryName;
    this.InitialEditingCategoryName = Category.CategoryName;
    this.CategoryEditError = '';
  }

  CancelCategoryEdit(): void {
    this.EditingCategoryId = null;
    this.EditingCategoryName = '';
    this.InitialEditingCategoryName = '';
    this.CategoryEditError = '';
  }

  private IsCategoryManagementDirty(): boolean {
    return !!this.NewCategoryName.trim() || (
      !!this.EditingCategoryId &&
      this.EditingCategoryName !== this.InitialEditingCategoryName
    );
  }

  SaveCategoryEdit(): void {
    if (!this.HasReportManagementPermission() || !this.EditingCategoryId) return;
    const Result = this.MockRbac.RenameCategory(this.EditingCategoryId, this.EditingCategoryName);
    const Messages = {
      'not-found': '找不到要編輯的報表分類。',
      'invalid-name': '請輸入分類名稱。',
      'duplicate-name': '分類名稱已存在，請使用其他名稱。',
      'system-reserved': '系統保留分類不可重新命名。',
    } as const;
    if (Result.Status !== 'renamed') {
      this.CategoryEditError = Messages[Result.Status];
      return;
    }
    this.CancelCategoryEdit();
    this.ShowSuccessToast(`報表分類已更新為「${Result.Category.CategoryName}」。`);
  }

  OpenDeleteCategoryDialog(CategoryId: string): void {
    if (!this.HasReportManagementPermission()) return;
    const Category = this.MockRbac.GetCategories().find((Entry) => Entry.CategoryId === CategoryId);
    if (!Category || Category.IsSystemReserved) return;
    this.CategoryDeleteError = '';
    this.DeletingCategory = Category;
  }

  CloseDeleteCategoryDialog(): void {
    this.DeletingCategory = null;
    this.CategoryDeleteError = '';
  }

  ConfirmDeleteCategory(): void {
    if (!this.HasReportManagementPermission() || !this.DeletingCategory) return;
    const CategoryId = this.DeletingCategory.CategoryId;
    const Result = this.MockRbac.DeleteCategory(CategoryId);
    const Messages = {
      'not-found': '找不到要刪除的報表分類。',
      'system-reserved': '系統保留分類不可刪除。',
    } as const;
    if (Result.Status !== 'deleted') {
      this.CategoryDeleteError = Messages[Result.Status];
      return;
    }
    if (this.ReportManagementCategoryId === CategoryId) {
      this.SetReportManagementCategory(this.AllCategoryFilterValue);
    }
    if (this.EditingCategoryId === CategoryId) this.CancelCategoryEdit();
    this.CloseDeleteCategoryDialog();
    this.ShowSuccessToast(
      Result.MovedReportCount
        ? `分類「${Result.DeletedCategoryName}」已刪除，${Result.MovedReportCount} 份報表已移至「未分類」，請重新設定報表分類。`
        : `分類「${Result.DeletedCategoryName}」已刪除。`,
    );
  }

  GetCategoryUsageCount(CategoryId: string): number {
    return this.MockRbac.GetCategoryUsageCount(CategoryId) ?? 0;
  }

  GetCategoryUsageLabel(Category: MockReportCategory): string {
    const UsageCount = this.GetCategoryUsageCount(Category.CategoryId);
    return Category.IsSystemReserved && UsageCount > 0
      ? `${UsageCount} 份報表待重新分類`
      : `${UsageCount} 份報表使用中`;
  }

  StartReportUpload(): void {
    if (!this.HasReportManagementPermission()) return;
    void this.router.navigate(['/report-management/upload']);
  }

  get ReportEditorTabs(): readonly PortalTab[] {
    return [
      { id: 'basic', label: '基本資訊' },
      { id: 'parameters', label: '參數設定', disabled: !this.EditingReportKey },
    ];
  }

  SetManagementTab(Tab: string): void {
    if (Tab === 'reports' || Tab === 'common-parameters') this.ManagementTab = Tab;
  }

  HasUnsavedChanges(): boolean {
    return (
      (this.IsCategoryManagementDialogOpen && this.IsCategoryManagementDirty()) ||
      this.IsReportEditorDirty() ||
      this.commonParameterManagement?.HasUnsavedChanges() === true ||
      this.reportParameterManagement?.HasUnsavedChanges() === true
    );
  }

  SetReportEditorTab(Tab: string): void {
    if (Tab === 'basic' || (Tab === 'parameters' && this.EditingReportKey)) {
      this.ReportEditorTab = Tab;
    }
  }

  OpenUploadReportDialog(): void {
    if (!this.HasReportManagementPermission()) return;
    this.EditingReportKey = null;
    this.ReportEditorTab = 'basic';
    this.DetectedParameterNames = [];
    this.ReportEditorDraft = this.CreateReportEditorDraft();
    this.SelectedReportFileName = '';
    this.ResetReportEditorState();
    this.IsUploadReportDialogOpen = true;
  }

  OpenEditReportDialog(ReportKey: MockReportKey): void {
    if (!this.HasReportManagementPermission()) return;
    void this.router.navigate(['/report-management/edit', ReportKey]);
  }

  RequestCloseReportEditor(): void {
    if (!this.IsUploadReportDialogOpen && !this.isDetailPage) return;
    if (!this.IsReportEditorDirty()) {
      this.CloseReportEditor();
      return;
    }
    this.IsReportDiscardConfirmationOpen = true;
  }

  ContinueEditingReport(): void {
    this.IsReportDiscardConfirmationOpen = false;
  }

  DiscardReportEditorChanges(): void {
    if (this.IsReportDiscardConfirmationOpen) this.CloseReportEditor();
  }

  CloseReportEditor(): void {
    this.IsUploadReportDialogOpen = false;
    this.IsReportDiscardConfirmationOpen = false;
    this.EditingReportKey = null;
    this.ReportEditorTab = 'basic';
    this.DetectedParameterNames = [];
    this.ReportEditorDraft = this.CreateReportEditorDraft();
    this.SelectedReportFileName = '';
    this.ResetReportEditorState();
    this.ReportEditorInitialDraft = null;
    this.InitialReportFileName = '';
    if (this.isDetailPage) void this.router.navigate(['/report-management']);
  }

  OpenReportCategoryQuickAdd(): void {
    if (!this.HasReportManagementPermission() || (!this.IsUploadReportDialogOpen && !this.isDetailPage)) return;
    this.QuickAddCategoryName = '';
    this.QuickAddCategoryError = '';
    this.IsReportCategoryQuickAddOpen = true;
  }

  CloseReportCategoryQuickAdd(): void {
    this.IsReportCategoryQuickAddOpen = false;
    this.QuickAddCategoryName = '';
    this.QuickAddCategoryError = '';
  }

  CreateReportCategoryQuickAdd(): void {
    if (!this.HasReportManagementPermission() || !this.IsReportCategoryQuickAddOpen) return;
    const Result = this.MockRbac.CreateCategory(this.QuickAddCategoryName);
    const Messages = {
      'invalid-name': '請輸入報表分類名稱。',
      'duplicate-name': '此報表分類已存在。',
      'system-reserved-name': '此名稱為系統保留分類，不可建立。',
    } as const;
    if (Result.Status !== 'created') {
      this.QuickAddCategoryError = Messages[Result.Status];
      return;
    }
    this.ReportEditorDraft = { ...this.ReportEditorDraft, CategoryId: Result.Category.CategoryId };
    this.NotifyCategoryReview(Result.Category);
    this.CloseReportCategoryQuickAdd();
    this.ShowSuccessToast(`新增報表分類「${Result.Category.CategoryName}」成功！`);
  }

  OnReportFileSelected(Event: Event): void {
    if (!this.HasReportManagementPermission()) return;
    const Input = Event.target as HTMLInputElement;
    const File = Input.files?.item(0);
    if (!File) return;
    if (!File.name.toLocaleLowerCase().endsWith('.rpt')) {
      this.SelectedReportFileName = '';
      this.ReportEditorError = '僅允許上傳 .rpt 報表檔案。';
      this.IsReportFileInvalid = true;
      Input.value = '';
      return;
    }
    this.SelectedReportFileName = File.name;
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
  }

  ClearReportFileReplacement(): void {
    this.SelectedReportFileName = this.InitialReportFileName;
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
  }

  SaveReport(): void {
    if (!this.HasReportManagementPermission()) return;
    const Error = this.GetReportEditorValidationError();
    if (Error) {
      this.ReportEditorError = Error;
      return;
    }
    const IsEditing = this.EditingReportKey !== null;
    let SavedReport: MockReportReadModel | null = null;
    const IsSaved = IsEditing
      ? (() => {
          const IsUpdated = this.MockRbac.UpdateReport(this.EditingReportKey!, {
            ...this.ReportEditorDraft,
            FileName: this.SelectedReportFileName,
          });
          SavedReport = IsUpdated ? this.MockRbac.GetReport(this.EditingReportKey!) : null;
          return Boolean(SavedReport);
        })()
      : (() => {
          SavedReport = this.MockRbac.CreateReport({
            ...this.ReportEditorDraft,
            FileName: this.SelectedReportFileName,
          });
          return Boolean(SavedReport);
        })();
    if (!IsSaved) {
      this.ReportEditorError = '儲存報表失敗，請重新確認欄位。';
      return;
    }
    this.EnsureReportManagementPagination();
    const DetectedParameterNames =
      !IsEditing || this.InitialReportFileName !== this.SelectedReportFileName
        ? this.ManagedParameters.RecognizeUploadedRptParameters(SavedReport!.ReportKey)
        : [];
    if (DetectedParameterNames.length) {
      this.EditingReportKey = SavedReport!.ReportKey;
      this.ReportEditorDraft = {
        ReportName: SavedReport!.ReportName,
        Description: SavedReport!.Description,
        CategoryId: SavedReport!.CategoryId,
        Enabled: SavedReport!.Enabled,
      };
      this.SelectedReportFileName = SavedReport!.FileName;
      this.ReportEditorTab = 'parameters';
      this.DetectedParameterNames = DetectedParameterNames;
      this.ResetReportEditorState();
      this.ShowSuccessToast('RPT 上傳完成，請確認新辨識的參數。');
      return;
    }
    this.CloseReportEditor();
    this.ShowSuccessToast(IsEditing ? 'Mock 報表已更新。' : 'Mock 報表已上傳。');
  }

  SaveReportDetail(): void {
    if (!this.isDetailPage || !this.EditingReportKey || !this.HasReportManagementPermission()) return;
    const Error = this.GetReportEditorValidationError();
    if (Error) {
      this.ReportEditorError = Error;
      return;
    }
    const ReportKey = this.EditingReportKey;
    const FileChanged = this.InitialReportFileName !== this.SelectedReportFileName;
    const IsUpdated = this.MockRbac.UpdateReport(ReportKey, {
      ...this.ReportEditorDraft,
      FileName: this.SelectedReportFileName,
    });
    if (!IsUpdated) {
      this.ReportEditorError = '儲存報表失敗，請重新確認欄位。';
      return;
    }
    const Updated = this.MockRbac.GetReport(ReportKey);
    if (!Updated) return;
    this.ReportEditorDraft = {
      ReportName: Updated.ReportName,
      Description: Updated.Description,
      CategoryId: Updated.CategoryId,
      Enabled: Updated.Enabled,
    };
    this.SelectedReportFileName = Updated.FileName;
    this.DetectedParameterNames = FileChanged
      ? this.ManagedParameters.RecognizeUploadedRptParameters(ReportKey)
      : [];
    this.ResetReportEditorState();
    if (this.DetectedParameterNames.length) {
      this.ReportEditorTab = 'parameters';
      this.ShowSuccessToast('報表已儲存，請確認新辨識的參數。');
      return;
    }
    this.ShowSuccessToast('報表已更新。');
  }

  OpenDeleteReportDialog(ReportKey: MockReportKey): void {
    if (!this.HasReportManagementPermission()) return;
    this.DeletingReport = this.MockRbac.GetReport(ReportKey);
  }

  CloseDeleteReportDialog(): void {
    this.DeletingReport = null;
  }

  ConfirmDeleteReport(): void {
    if (!this.HasReportManagementPermission() || !this.DeletingReport) return;
    const ReportName = this.DeletingReport.ReportName;
    if (this.MockRbac.DeleteReport(this.DeletingReport.ReportKey)) {
      this.PinnedReportManagementKeys.delete(this.DeletingReport.ReportKey);
      this.EnsureReportManagementPagination();
      this.ShowSuccessToast(`Mock 報表「${ReportName}」已刪除。`);
    }
    this.CloseDeleteReportDialog();
  }

  private HasReportManagementPermission(): boolean {
    return this.Auth.HasManagementPermission('RptManagement');
  }

  private LoadReportDetail(ReportKey: MockReportKey): boolean {
    const Report = this.MockRbac.GetReport(ReportKey);
    if (!Report) return false;
    this.EditingReportKey = Report.ReportKey;
    this.ReportEditorTab = 'basic';
    this.DetectedParameterNames = [];
    this.ReportEditorDraft = {
      ReportName: Report.ReportName,
      Description: Report.Description,
      CategoryId: Report.CategoryId,
      Enabled: Report.Enabled,
    };
    this.SelectedReportFileName = Report.FileName;
    this.ResetReportEditorState();
    return true;
  }

  private ResetReportManagementPagination(): void {
    this.ReportManagementCurrentPage = 1;
  }

  private EnsureReportManagementPagination(): void {
    this.GoToReportManagementPage(this.ReportManagementCurrentPage);
  }

  private CreateReportEditorDraft(): ReportEditorDraft {
    return { ReportName: '', Description: '', CategoryId: '', Enabled: false };
  }

  private ResetReportEditorState(): void {
    this.ReportEditorError = '';
    this.IsReportFileInvalid = false;
    this.IsReportDiscardConfirmationOpen = false;
    this.CloseReportCategoryQuickAdd();
    this.ReportEditorInitialDraft = { ...this.ReportEditorDraft };
    this.InitialReportFileName = this.SelectedReportFileName;
  }

  private IsReportEditorDirty(): boolean {
    const InitialDraft = this.ReportEditorInitialDraft;
    return Boolean(
      InitialDraft &&
        (InitialDraft.ReportName !== this.ReportEditorDraft.ReportName ||
          InitialDraft.Description !== this.ReportEditorDraft.Description ||
          InitialDraft.CategoryId !== this.ReportEditorDraft.CategoryId ||
          InitialDraft.Enabled !== this.ReportEditorDraft.Enabled ||
          this.InitialReportFileName !== this.SelectedReportFileName),
    );
  }

  private GetReportEditorValidationError(): string {
    if (this.IsReportFileInvalid || (this.SelectedReportFileName && !this.SelectedReportFileName.toLocaleLowerCase().endsWith('.rpt'))) return '僅允許上傳 .rpt 報表檔案。';
    if (!this.ReportEditorDraft.ReportName.trim()) return '請輸入報表名稱。';
    if (!this.ReportEditorDraft.Description.trim()) return '請輸入報表說明。';
    if (!this.ReportEditorDraft.CategoryId) return '請選擇報表分類。';
    if (!this.EditingReportKey && !this.SelectedReportFileName) return '請選擇 RPT 報表檔案。';
    return '';
  }

  private NotifyCategoryReview(Category: MockReportCategory): void {
    this.NotificationCenter.CreateCategoryReview(
      Category,
      this.Auth.CurrentUser?.Account ?? '前台使用者',
    );
  }

  private ShowSuccessToast(Message: string): void {
    this.Notifications.ShowSuccess(Message);
  }
}
