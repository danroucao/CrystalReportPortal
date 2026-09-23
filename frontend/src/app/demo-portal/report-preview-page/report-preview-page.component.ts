import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { ReportExecutionRequest } from '../../services/report-api.models';
import { ReportService } from '../../services/report.service';

export type ReportPreviewOrigin = 'all' | 'favorites';

export interface ParameterReportSearchState {
  readonly CategoryId: string;
  readonly SearchText: string;
  readonly SortField: 'ReportName' | 'CreatedAt' | 'UpdatedAt' | null;
  readonly SortDirection: 'asc' | 'desc';
  readonly StartDate: string;
  readonly EndDate: string;
}

interface ExportOption {
  readonly Label: string;
  readonly FormatKey: string;
  readonly Enabled: boolean;
}

type OutputAction = 'BrowserPrint';

/**
 * The report-preview content extracted from DemoPortalComponent.
 *
 * The containing portal still owns the route guard, page heading, navigation,
 * and global toast rendering. This component owns only preview-specific state.
 */
@Component({
  selector: 'app-report-preview-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-preview-page.component.html',
  styleUrl: './report-preview-page.component.scss',
})
export class ReportPreviewPageComponent implements OnInit, OnDestroy {
  readonly Auth = inject(AuthService);
  private readonly reports = inject(ReportService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  IsExportMenuOpen = false;
  IsPrintMenuOpen = false;
  PreviewNotice = '';
  PreviewUrl: SafeResourceUrl | null = null;
  IsPreviewLoading = false;
  PreviewError = '';
  private PreviewObjectUrl: string | null = null;
  private PreviewBlob: Blob | null = null;
  private CurrentExecutionRequest: ReportExecutionRequest | null = null;
  ReportPreviewOrigin: ReportPreviewOrigin = 'all';
  private ReturnToParameterSearchState: ParameterReportSearchState | null =
    null;

  readonly ExportOptions: readonly ExportOption[] = [
    { Label: 'PDF', FormatKey: 'Pdf', Enabled: true },
  ];

  get ReportPreviewReturnLabel(): string {
    return this.ReportPreviewOrigin === 'favorites'
      ? '返回我的收藏'
      : '返回所有報表';
  }

  ngOnInit(): void {
    if (!this.Auth.SelectedReport) {
      void this.router.navigate(['/reports/parameters'], {
        state: { ReportSelectionRequired: true },
      });
      return;
    }

    const NavigationState =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    this.ReportPreviewOrigin = this.ToReportPreviewOrigin(
      NavigationState?.['ReportPreviewOrigin'],
    );
    this.ReturnToParameterSearchState = this.ToParameterSearchState(
      NavigationState?.['ParameterSearchState'],
    );
    const ExecutionRequest = this.ToExecutionRequest(
      NavigationState?.['ReportExecutionRequest'],
    );
    this.CurrentExecutionRequest = ExecutionRequest;
    this.LoadPreview(ExecutionRequest);
  }

  ngOnDestroy(): void {
    this.RevokePreviewUrl();
  }

  private LoadPreview(ExecutionRequest: ReportExecutionRequest | null): void {
    const Report = this.Auth.SelectedReport;
    if (!Report?.ReportId) return;

    this.IsPreviewLoading = true;
    this.PreviewError = '';
    const PreviewRequest = ExecutionRequest
      ? this.reports.ExecuteReport(Report.ReportId, ExecutionRequest)
      : this.reports.GetReportPreview(Report.ReportId);
    PreviewRequest
      .pipe(finalize(() => (this.IsPreviewLoading = false)))
      .subscribe({
        next: (Pdf) => {
          this.RevokePreviewUrl();
          this.PreviewBlob = Pdf;
          this.PreviewObjectUrl = URL.createObjectURL(Pdf);
          this.PreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            this.PreviewObjectUrl,
          );
        },
        error: () => {
          this.RevokePreviewUrl();
          this.PreviewBlob = null;
          this.PreviewUrl = null;
          this.PreviewError = '目前無法產生報表預覽，請稍後再試。';
        },
      });
  }

  RetryPreview(): void {
    if (this.IsPreviewLoading) return;
    this.LoadPreview(this.CurrentExecutionRequest);
  }

  private ToExecutionRequest(State: unknown): ReportExecutionRequest | null {
    if (!State || typeof State !== 'object') return null;
    const Value = State as Partial<ReportExecutionRequest>;
    if (!Array.isArray(Value.parameters)) return null;
    const Parameters = Value.parameters.filter(
      (Parameter): Parameter is { parameterId: number; values: readonly string[] } =>
        typeof Parameter?.parameterId === 'number' &&
        Array.isArray(Parameter.values),
    );
    return Parameters.length === Value.parameters.length
      ? { parameters: Parameters }
      : null;
  }

  private RevokePreviewUrl(): void {
    if (this.PreviewObjectUrl) URL.revokeObjectURL(this.PreviewObjectUrl);
    this.PreviewObjectUrl = null;
    this.PreviewBlob = null;
  }

  ToggleExportMenu(): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanExport) {
      this.ShowPermissionNotice('匯出');
      return;
    }
    this.IsPrintMenuOpen = false;
    this.IsExportMenuOpen = !this.IsExportMenuOpen;
  }

  SelectExportOption(Option: ExportOption): void {
    if (
      !this.Auth.SelectedReportCategoryPermission.CanExport ||
      !Option.Enabled ||
      !this.ExportOptions.includes(Option)
    ) {
      this.ShowPermissionNotice('匯出');
      return;
    }
    this.IsExportMenuOpen = false;
    if (Option.FormatKey !== 'Pdf' || !this.PreviewBlob) {
      this.PreviewNotice = `${Option.Label} 匯出目前尚未支援。`;
      return;
    }

    const DownloadUrl = URL.createObjectURL(this.PreviewBlob);
    const Link = document.createElement('a');
    Link.href = DownloadUrl;
    Link.download = `${this.Auth.SelectedReport?.ReportName ?? 'report'}.pdf`;
    Link.click();
    URL.revokeObjectURL(DownloadUrl);
    this.PreviewNotice = 'PDF 已開始下載。';
  }

  DownloadPdf(): void {
    if (!this.PreviewBlob) {
      this.PreviewNotice = '目前沒有可下載的 PDF。';
      return;
    }

    const downloadUrl = URL.createObjectURL(this.PreviewBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${this.Auth.SelectedReport?.ReportName ?? 'report'}.pdf`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    this.PreviewNotice = 'PDF 已開始下載。';
  }

  OpenPdfPreview(): void {
    if (!this.PreviewObjectUrl) {
      this.PreviewNotice = '目前沒有可開啟的 PDF。';
      return;
    }

    const previewWindow = window.open(this.PreviewObjectUrl, '_blank');
    this.PreviewNotice = previewWindow
      ? '已在新視窗開啟 PDF 預覽。'
      : '瀏覽器封鎖了新視窗，請改用下載 PDF。';
  }

  TogglePrintMenu(): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanPrint) {
      this.ShowPermissionNotice('列印');
      return;
    }
    this.IsExportMenuOpen = false;
    this.IsPrintMenuOpen = !this.IsPrintMenuOpen;
  }

  SelectOutputAction(ActionName: OutputAction): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanPrint) {
      this.ShowPermissionNotice('列印');
      return;
    }
    this.IsPrintMenuOpen = false;
    if (!this.PreviewObjectUrl) {
      this.PreviewNotice = '目前沒有可列印的 PDF 預覽。';
      return;
    }

    const PrintWindow = window.open(this.PreviewObjectUrl, '_blank');
    if (!PrintWindow) {
      this.PreviewNotice = '瀏覽器封鎖了列印視窗，請允許彈出視窗後再試。';
      return;
    }

    PrintWindow.addEventListener('load', () => PrintWindow.print(), {
      once: true,
    });
    this.PreviewNotice = '已開啟列印視窗。';
  }

  ReturnToReportList(): void {
    if (this.ReportPreviewOrigin === 'favorites') {
      void this.router.navigate(['/reports']);
      return;
    }
    void this.router.navigate(['/reports/parameters'], {
      state: this.ReturnToParameterSearchState
        ? { ParameterSearchState: this.ReturnToParameterSearchState }
        : undefined,
    });
  }

  @HostListener('document:keydown.escape')
  CloseMenuOnEscape(): void {
    if (this.IsExportMenuOpen) this.IsExportMenuOpen = false;
    else if (this.IsPrintMenuOpen) this.IsPrintMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  CloseMenuOnOutsideClick(Event: MouseEvent): void {
    const Target = Event.target;
    if (!(Target instanceof Element)) return;
    if (this.IsExportMenuOpen && !Target.closest('.export-dropdown')) {
      this.IsExportMenuOpen = false;
    }
    if (this.IsPrintMenuOpen && !Target.closest('.print-dropdown')) {
      this.IsPrintMenuOpen = false;
    }
  }

  private ShowPermissionNotice(ActionName: string): void {
    this.IsExportMenuOpen = false;
    this.IsPrintMenuOpen = false;
    this.PreviewNotice = `目前角色沒有${ActionName}權限。`;
  }

  private ToReportPreviewOrigin(State: unknown): ReportPreviewOrigin {
    return State === 'favorites' ? 'favorites' : 'all';
  }

  private ToParameterSearchState(
    State: unknown,
  ): ParameterReportSearchState | null {
    if (!State || typeof State !== 'object') return null;
    const Value = State as Partial<ParameterReportSearchState>;
    if (
      typeof Value.CategoryId !== 'string' ||
      typeof Value.SearchText !== 'string' ||
      (Value.SortField !== null &&
        Value.SortField !== 'ReportName' &&
        Value.SortField !== 'CreatedAt' &&
        Value.SortField !== 'UpdatedAt') ||
      (Value.SortDirection !== 'asc' && Value.SortDirection !== 'desc') ||
      typeof Value.StartDate !== 'string' ||
      typeof Value.EndDate !== 'string'
    ) {
      return null;
    }
    return {
      CategoryId: Value.CategoryId,
      SearchText: Value.SearchText,
      SortField: Value.SortField,
      SortDirection: Value.SortDirection,
      StartDate: Value.StartDate,
      EndDate: Value.EndDate,
    };
  }
}
