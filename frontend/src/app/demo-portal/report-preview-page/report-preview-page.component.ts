import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, forkJoin, tap } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { ReportExecutionRequest } from '../../services/report-api.models';
import { ReportPreviewManifest, ReportService } from '../../services/report.service';

export type ReportPreviewOrigin = 'all' | 'favorites';

export interface ParameterReportSearchState {
  readonly CategoryId: string;
  readonly SearchText: string;
  readonly SortField: 'ReportName' | 'CreatedAt' | 'UpdatedAt' | null;
  readonly SortDirection: 'asc' | 'desc';
  readonly StartDate: string;
  readonly EndDate: string;
}

@Component({
  selector: 'app-report-preview-page', standalone: true, imports: [CommonModule],
  templateUrl: './report-preview-page.component.html', styleUrl: './report-preview-page.component.scss',
})
export class ReportPreviewPageComponent implements OnInit, OnDestroy {
  readonly Auth = inject(AuthService);
  private readonly reports = inject(ReportService);
  private readonly router = inject(Router);
  IsExportMenuOpen = false;
  IsPrintMenuOpen = false;
  PreviewNotice = '';
  PreviewPageUrls: string[] = [];
  PreviewPageCount = 0;
  LoadedPreviewPageCount = 0;
  CurrentPreviewPageIndex = 0;
  PreviewZoom = 100;
  IsPreviewLoading = false;
  PreviewError = '';
  private CurrentExecutionRequest: ReportExecutionRequest | null = null;
  private ReturnToParameterSearchState: ParameterReportSearchState | null = null;
  ReportPreviewOrigin: ReportPreviewOrigin = 'all';

  get HasPreview(): boolean { return this.PreviewPageUrls.length > 0; }
  get CurrentPreviewPageUrl(): string | null { return this.PreviewPageUrls[this.CurrentPreviewPageIndex] ?? null; }
  get PreviewProgressLabel(): string { return `${this.LoadedPreviewPageCount} / ${this.PreviewPageCount} 頁`; }
  get ReportPreviewReturnLabel(): string {
    return this.ReportPreviewOrigin === 'favorites' ? '返回我的常用報表' : '返回所有報表';
  }

  ngOnInit(): void {
    if (!this.Auth.SelectedReport) {
      void this.router.navigate(['/reports/parameters'], { state: { ReportSelectionRequired: true } });
      return;
    }
    const state = this.router.getCurrentNavigation()?.extras.state ?? history.state;
    this.ReportPreviewOrigin = state?.['ReportPreviewOrigin'] === 'favorites' ? 'favorites' : 'all';
    this.ReturnToParameterSearchState = this.ToParameterSearchState(state?.['ParameterSearchState']);
    this.CurrentExecutionRequest = this.ToExecutionRequest(state?.['ReportExecutionRequest']);
    this.LoadPreview();
  }

  ngOnDestroy(): void { this.ClearPreviewPages(); }
  RetryPreview(): void { if (!this.IsPreviewLoading) this.LoadPreview(); }

  ToggleExportMenu(): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanExport) return;
    this.IsPrintMenuOpen = false;
    this.IsExportMenuOpen = !this.IsExportMenuOpen;
  }

  TogglePrintMenu(): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanPrint) return;
    this.IsExportMenuOpen = false;
    this.IsPrintMenuOpen = !this.IsPrintMenuOpen;
  }

  OnExportSelection(value: string): void {
    if (value === 'pdf') this.DownloadPdf();
  }

  OnPrintSelection(value: string): void {
    if (value === 'print') this.PrintPdf();
  }

  DownloadPdf(): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanExport) return;
    this.IsExportMenuOpen = false;
    this.GetOutputPdf().subscribe({
      next: (pdf) => {
        const url = URL.createObjectURL(pdf);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.Auth.SelectedReport?.ReportName ?? 'report'}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        this.PreviewNotice = 'PDF 已開始下載。';
      },
      error: (error: unknown) => void this.SetPreviewError(error),
    });
  }

  PrintPdf(): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanPrint) return;
    this.IsPrintMenuOpen = false;
    this.GetPrintPdf().subscribe({
      next: (pdf) => {
        const url = URL.createObjectURL(pdf);
        const printWindow = window.open(url, '_blank');
        if (!printWindow) {
          URL.revokeObjectURL(url);
          this.PreviewNotice = '無法開啟列印視窗，請允許瀏覽器彈出式視窗後再試。';
          return;
        }
        printWindow.addEventListener('load', () => {
          printWindow.print();
          window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        }, { once: true });
      },
      error: (error: unknown) => void this.SetPreviewError(error),
    });
  }

  ReturnToReportList(): void {
    if (this.ReportPreviewOrigin === 'favorites') {
      void this.router.navigate(['/reports']);
      return;
    }
    void this.router.navigate(['/reports/parameters'], {
      state: this.ReturnToParameterSearchState ? { ParameterSearchState: this.ReturnToParameterSearchState } : undefined,
    });
  }

  @HostListener('document:keydown.escape')
  CloseMenus(): void { this.IsExportMenuOpen = false; this.IsPrintMenuOpen = false; }

  GoToPreviousPreviewPage(): void {
    this.CurrentPreviewPageIndex = Math.max(0, this.CurrentPreviewPageIndex - 1);
  }

  GoToNextPreviewPage(): void {
    this.CurrentPreviewPageIndex = Math.min(this.PreviewPageUrls.length - 1, this.CurrentPreviewPageIndex + 1);
  }

  ZoomPreview(change: number): void {
    this.PreviewZoom = Math.min(175, Math.max(60, this.PreviewZoom + change));
  }

  ResetPreviewZoom(): void { this.PreviewZoom = 100; }

  private LoadPreview(): void {
    const report = this.Auth.SelectedReport;
    if (!report?.ReportId) return;
    this.ClearPreviewPages();
    this.PreviewError = '';
    this.PreviewNotice = '';
    this.IsPreviewLoading = true;
    const request = this.CurrentExecutionRequest
      ? this.reports.ExecuteReport(report.ReportId, this.CurrentExecutionRequest)
      : this.reports.GetReportPreview(report.ReportId);
    request.subscribe({
      next: (manifest) => this.LoadPreviewPages(manifest),
      error: (error: unknown) => { this.IsPreviewLoading = false; void this.SetPreviewError(error); },
    });
  }

  private LoadPreviewPages(manifest: ReportPreviewManifest): void {
    this.PreviewPageCount = manifest.pageCount;
    this.LoadedPreviewPageCount = 0;
    this.CurrentPreviewPageIndex = 0;
    const pages = Array.from({ length: manifest.pageCount }, (_, index) =>
      this.reports.GetPreviewPage(manifest.previewId, index + 1).pipe(
        tap(() => this.LoadedPreviewPageCount += 1),
      ));
    forkJoin(pages).pipe(finalize(() => (this.IsPreviewLoading = false))).subscribe({
      next: (images) => this.PreviewPageUrls = images.map((image) => URL.createObjectURL(image)),
      error: (error: unknown) => void this.SetPreviewError(error),
    });
  }

  private GetOutputPdf() {
    const report = this.Auth.SelectedReport;
    if (!report?.ReportId) throw new Error('No report is selected.');
    return this.CurrentExecutionRequest
      ? this.reports.ExportExecutedReport(report.ReportId, this.CurrentExecutionRequest)
      : this.reports.ExportSavedDataReport(report.ReportId);
  }

  private GetPrintPdf() {
    const report = this.Auth.SelectedReport;
    if (!report?.ReportId) throw new Error('No report is selected.');
    return this.CurrentExecutionRequest
      ? this.reports.PrintExecutedReport(report.ReportId, this.CurrentExecutionRequest)
      : this.reports.PrintSavedDataReport(report.ReportId);
  }

  private ClearPreviewPages(): void {
    this.PreviewPageUrls.forEach((url) => URL.revokeObjectURL(url));
    this.PreviewPageUrls = [];
    this.PreviewPageCount = 0;
    this.LoadedPreviewPageCount = 0;
    this.CurrentPreviewPageIndex = 0;
  }

  private async SetPreviewError(error: unknown): Promise<void> {
    const fallback = '目前無法產生報表預覽，請稍後再試。';
    if (!(error instanceof HttpErrorResponse)) { this.PreviewError = fallback; return; }
    try {
      const body = error.error instanceof Blob ? await error.error.text() : JSON.stringify(error.error ?? {});
      const payload = JSON.parse(body) as { message?: string; detail?: string };
      this.PreviewError = payload.detail || payload.message || `${fallback}（HTTP ${error.status}）`;
    } catch { this.PreviewError = `${fallback}（HTTP ${error.status}）`; }
  }

  private ToExecutionRequest(value: unknown): ReportExecutionRequest | null {
    if (!value || typeof value !== 'object') return null;
    const request = value as Partial<ReportExecutionRequest>;
    if (!Array.isArray(request.parameters)) return null;
    return request.parameters.every((item) => typeof item?.parameterId === 'number' && Array.isArray(item.values))
      ? { parameters: request.parameters } : null;
  }

  private ToParameterSearchState(value: unknown): ParameterReportSearchState | null {
    if (!value || typeof value !== 'object') return null;
    const state = value as Partial<ParameterReportSearchState>;
    return typeof state.CategoryId === 'string' && typeof state.SearchText === 'string' &&
      typeof state.StartDate === 'string' && typeof state.EndDate === 'string' &&
      (state.SortField === null || state.SortField === 'ReportName' || state.SortField === 'CreatedAt' || state.SortField === 'UpdatedAt') &&
      (state.SortDirection === 'asc' || state.SortDirection === 'desc')
      ? state as ParameterReportSearchState : null;
  }
}
