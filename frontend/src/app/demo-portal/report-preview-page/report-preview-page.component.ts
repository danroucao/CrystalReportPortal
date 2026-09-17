import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

export type ReportPreviewOrigin = 'all' | 'favorites';

export interface ParameterReportSearchState {
  readonly CategoryId: string;
  readonly SearchText: string;
  readonly SortField: 'ReportName' | 'CreatedAt' | 'UpdatedAt' | null;
  readonly SortDirection: 'asc' | 'desc';
  readonly StartDate: string;
  readonly EndDate: string;
}

interface MockExportOption {
  readonly Label: string;
  readonly FormatKey: string;
  readonly Enabled: boolean;
}

type OutputAction = 'BrowserPrint' | 'FixedPrinterPrint';

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
export class ReportPreviewPageComponent implements OnInit {
  readonly Auth = inject(AuthService);
  private readonly router = inject(Router);

  IsExportMenuOpen = false;
  IsPrintMenuOpen = false;
  MockNotice = '';
  ReportPreviewOrigin: ReportPreviewOrigin = 'all';
  private ReturnToParameterSearchState: ParameterReportSearchState | null =
    null;

  readonly ExportOptions: readonly MockExportOption[] = [
    { Label: 'PDF', FormatKey: 'Pdf', Enabled: true },
    { Label: 'Excel', FormatKey: 'Excel', Enabled: true },
    { Label: 'Word', FormatKey: 'Word', Enabled: true },
    { Label: 'CSV', FormatKey: 'Csv', Enabled: true },
    { Label: 'RTF', FormatKey: 'Rtf', Enabled: true },
    { Label: '文字檔', FormatKey: 'Text', Enabled: true },
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
  }

  ToggleExportMenu(): void {
    if (!this.Auth.SelectedReportCategoryPermission.CanExport) {
      this.ShowPermissionNotice('匯出');
      return;
    }
    this.IsPrintMenuOpen = false;
    this.IsExportMenuOpen = !this.IsExportMenuOpen;
  }

  SelectExportOption(Option: MockExportOption): void {
    if (
      !this.Auth.SelectedReportCategoryPermission.CanExport ||
      !Option.Enabled ||
      !this.ExportOptions.includes(Option)
    ) {
      this.ShowPermissionNotice('匯出');
      return;
    }
    this.IsExportMenuOpen = false;
    this.MockNotice = `${Option.Label} 匯出目前為前端 Mock 操作，尚未串接正式報表匯出服務。`;
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
    const ActionLabel =
      ActionName === 'BrowserPrint' ? '瀏覽器列印' : '固定印表機列印';
    this.MockNotice = `${ActionLabel}目前為前端 Mock 操作，尚未串接正式列印服務。`;
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
    this.MockNotice = `目前角色沒有${ActionName}權限。`;
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
