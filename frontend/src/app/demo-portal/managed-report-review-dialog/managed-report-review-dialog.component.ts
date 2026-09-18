import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concatMap, finalize, forkJoin, from, of, switchMap, toArray } from 'rxjs';

import {
  ManagedReport,
  ManagedReportParameter,
  ManagedReportParameterOption,
  ManagedReportParametersResponse,
  ReportTestPreviewRequest,
  UpdateManagedReportParameterRequest,
} from '../../services/managed-report-api.models';
import { NotificationService } from '../../services/notification.service';
import { ReportService } from '../../services/report.service';

@Component({
  selector: 'app-managed-report-review-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './managed-report-review-dialog.component.html',
  styleUrl: './managed-report-review-dialog.component.scss',
})
export class ManagedReportReviewDialogComponent implements OnInit, OnDestroy {
  private readonly reportsApi = inject(ReportService);
  private readonly notifications = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);

  @Input({ required: true }) report!: ManagedReport;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly approved = new EventEmitter<void>();
  @Output() readonly completed = new EventEmitter<void>();

  parameterResponse: ManagedReportParametersResponse | null = null;
  readonly values: Record<number, string[]> = {};
  readonly options: Record<number, readonly ManagedReportParameterOption[]> = {};
  readonly parameterDrafts: Record<number, UpdateManagedReportParameterRequest> = {};
  isLoading = true;
  isSavingConfiguration = false;
  isPreviewing = false;
  isApproving = false;
  errorMessage = '';
  errorDetails = '';
  previewUrl: SafeResourceUrl | null = null;
  private previewObjectUrl: string | null = null;
  previewSucceeded = false;

  get isSavedDataPreview(): boolean {
    return (
      this.report.configurationStatus ===
      'PendingConfiguration'
    );
  }

  get visibleParameters(): readonly ManagedReportParameter[] {
    return (this.parameterResponse?.parameters ?? [])
      .filter((parameter) => parameter.isVisible && parameter.valueSourceType !== 'CurrentUser')
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  get configurationParameters(): readonly ManagedReportParameter[] {
    return [...(this.parameterResponse?.parameters ?? [])]
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  ngOnInit(): void {
    this.loadParameters();
  }

  ngOnDestroy(): void {
    this.revokePreviewUrl();
  }

  close(): void {
    if (this.isPreviewing || this.isApproving || this.isSavingConfiguration) return;
    this.closed.emit();
  }

  selectMultiple(parameterId: number, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.values[parameterId] = Array.from(select.selectedOptions, (option) => option.value);
    this.invalidatePreview();
  }

  setSingleValue(parameterId: number, value: string): void {
    this.values[parameterId] = value === '' ? [] : [value];
    this.invalidatePreview();
  }

  testPreview(): void {
    if (!this.isSavedDataPreview) {
      const validationError = this.validate();

      if (validationError) {
        this.errorMessage = validationError;
        return;
      }
    }

    const request: ReportTestPreviewRequest = {
      parameters: this.isSavedDataPreview
        ? []
        : this.visibleParameters.map((parameter) => ({
            parameterId: parameter.parameterId,
            values:
              this.values[parameter.parameterId] ?? [],
          })),
    };

    this.isPreviewing = true;
    this.errorMessage = '';
    this.errorDetails = '';
    this.previewSucceeded = false;

    this.reportsApi
      .TestPreviewManagedReport(
        this.report.reportId,
        request,
        this.isSavedDataPreview,
      )
      .pipe(
        finalize(() => (this.isPreviewing = false)),
      )
      .subscribe({
        next: (pdf) => {
          this.revokePreviewUrl();

          this.previewObjectUrl =
            URL.createObjectURL(pdf);

          this.previewUrl =
            this.sanitizer
              .bypassSecurityTrustResourceUrl(
                this.previewObjectUrl,
              );

          this.previewSucceeded = true;
        },
        error: (error: unknown) => {
          void this.setErrorMessage(error);
        },
      });
  }

  saveConfiguration(): void {
    const parameters = this.configurationParameters;
    if (!parameters.length) {
      this.errorMessage = '此報表沒有可設定的參數。';
      return;
    }

    this.isSavingConfiguration = true;
    this.errorMessage = '';
    from(parameters)
      .pipe(
        concatMap((parameter) =>
          this.reportsApi.UpdateManagedReportParameter(
            this.report.reportId,
            parameter.parameterId,
            this.parameterDrafts[parameter.parameterId],
          ),
        ),
        toArray(),
        switchMap(() => this.reportsApi.CompleteManagedReportParameters(this.report.reportId)),
        finalize(() => (this.isSavingConfiguration = false)),
      )
      .subscribe({
        next: (result) => {
          this.notifications.ShowSuccess(result.message);
          this.completed.emit();
        },
        error: (error: unknown) => void this.setErrorMessage(error),
      });
  }

  updateDraft(
    parameterId: number,
    field: keyof UpdateManagedReportParameterRequest,
    value: string | boolean | number | null,
  ): void {
    const draft = this.parameterDrafts[parameterId];
    if (!draft) return;
    let updated = { ...draft, [field]: value } as UpdateManagedReportParameterRequest;
    if (field === 'valueSourceType') {
      updated = {
        ...updated,
        inputType: value === 'CurrentUser'
          ? 'Hidden'
          : this.defaultInputType(updated.dataType),
      };
    }
    this.parameterDrafts[parameterId] = updated;
  }

  approve(): void {
    if (
      this.isSavedDataPreview ||
      !this.previewSucceeded
    ) {
      return;
    }

    this.isApproving = true;
    this.errorMessage = '';
    this.errorDetails = '';

    this.reportsApi
      .ApproveManagedReportConfiguration(
        this.report.reportId,
      )
      .pipe(
        finalize(() => (this.isApproving = false)),
      )
      .subscribe({
        next: (result) => {
          this.notifications.ShowSuccess(
            result.message,
          );
          this.approved.emit();
        },
        error: (error: unknown) => {
          void this.setErrorMessage(error);
        },
      });
  }

  private loadParameters(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.errorDetails = '';
    this.reportsApi.GetManagedReportParameters(this.report.reportId).pipe(
      switchMap((response) => {
        this.parameterResponse = response;
        for (const parameter of response.parameters) {
          this.parameterDrafts[parameter.parameterId] = this.createParameterDraft(parameter);
          this.values[parameter.parameterId] = parameter.defaultValue
            ? [parameter.defaultValue]
            : [];
        }
        const lovParameters = response.parameters.filter(
          (parameter) => parameter.isVisible && parameter.valueSourceType === 'SqlLov',
        );
        if (!lovParameters.length) return of([]);
        return forkJoin(lovParameters.map((parameter) =>
          this.reportsApi.GetManagedReportParameterOptions(
            this.report.reportId,
            parameter.parameterId,
          ).pipe(switchMap((result) => {
            this.options[parameter.parameterId] = result.data;
            return of(result);
          })),
        ));
      }),
      finalize(() => (this.isLoading = false)),
    ).subscribe({
      error: (error: unknown) => void this.setErrorMessage(error),
    });
  }

  private createParameterDraft(
    parameter: ManagedReportParameter,
  ): UpdateManagedReportParameterRequest {
    const useCurrentUser = parameter.valueSourceType === 'CurrentUser';
    return {
      displayName: parameter.displayName,
      dataType: parameter.dataType,
      inputType: useCurrentUser ? 'Hidden' : parameter.allowMultipleValues ? 'MultiSelect' : this.defaultInputType(parameter.dataType),
      valueSourceType: useCurrentUser ? 'CurrentUser' : 'UserInput',
      isRequired: parameter.isRequired,
      allowMultipleValues: parameter.allowMultipleValues,
      allowRangeValues: parameter.allowRangeValues,
      isVisible: parameter.isVisible,
      defaultValue: parameter.defaultValue,
      description: parameter.description,
      dataSourceId: parameter.dataSourceId,
      sqlQuery: parameter.sqlQuery,
      valueField: parameter.valueField,
      displayField: parameter.displayField,
      addToCommonTemplates: false,
    };
  }

  private defaultInputType(dataType: string): string {
    if (dataType === 'Date') return 'DatePicker';
    if (dataType === 'Number') return 'Number';
    return 'Text';
  }

  private validate(): string {
    for (const parameter of this.visibleParameters) {
      if (parameter.isRequired && !(this.values[parameter.parameterId]?.length)) {
        return `請填寫「${parameter.displayName}」。`;
      }
    }
    return '';
  }

  private invalidatePreview(): void {
    this.previewSucceeded = false;
    this.revokePreviewUrl();
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = null;
    this.previewUrl = null;
  }

  private async setErrorMessage(error: unknown): Promise<void> {
    const result = await this.toErrorMessage(error);
    this.errorMessage = result.message;
    this.errorDetails = result.details;
  }

  private async toErrorMessage(
    error: unknown,
  ): Promise<{ message: string; details: string }> {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        return { message: '你沒有測試或確認此報表的權限。', details: '' };
      }
      if (typeof error.error?.message === 'string') {
        return { message: error.error.message, details: '' };
      }
      if (error.error instanceof Blob) {
        try {
          const body = JSON.parse(await error.error.text()) as {
            message?: unknown;
            detail?: unknown;
          };
          const details = [body.message, body.detail]
            .filter((value): value is string => typeof value === 'string')
            .join('\n\n');
          if (details) {
            return {
              message: '報表轉檔失敗，請確認資料來源、RPT 命令與參數設定。',
              details,
            };
          }
        } catch {
          // Ignore non-JSON error bodies and use the fallback below.
        }
        return {
          message: '報表測試預覽失敗，請確認 Crystal Service 與資料庫連線。',
          details: '',
        };
      }
    }
    return {
      message: '報表測試預覽失敗，請確認參數、資料來源與 Crystal Service。',
      details: '',
    };
  }
}
