import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  CommonParameterDataType,
  CommonParameterInputType,
  CommonParameterTemplate,
  CommonParameterValueSourceType,
  SaveCommonParameterTemplateRequest,
  CommonParameterDataSourceOption,
} from '../../services/common-parameter-template-api.models';
import { CommonParameterTemplateService } from '../../services/common-parameter-template.service';

type EnabledFilter = 'all' | 'enabled' | 'disabled';

@Component({
  selector: 'app-common-parameter-template-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './common-parameter-template-page.component.html',
  styleUrl: './common-parameter-template-page.component.scss',
})
export class CommonParameterTemplatePageComponent implements OnInit {
  private readonly api = inject(CommonParameterTemplateService);

  readonly dataTypes: readonly CommonParameterDataType[] =
    ['String', 'Date', 'DateTime', 'Number', 'Boolean'];
  readonly inputTypes: readonly CommonParameterInputType[] =
    ['Text', 'DatePicker', 'Select', 'MultiSelect', 'Hidden', 'Number', 'Checkbox'];
  readonly valueSourceTypes: readonly CommonParameterValueSourceType[] =
    ['UserInput', 'SqlLov', 'CurrentUser'];

  dataSourceOptions: readonly CommonParameterDataSourceOption[] = [];
  templates: readonly CommonParameterTemplate[] = [];
  enabledFilter: EnabledFilter = 'all';
  searchText = '';
  isLoading = false;
  isSaving = false;
  loadError = '';
  editorError = '';
  editingTemplateId: number | null = null;
  isEditorOpen = false;
  draft = this.createEmptyDraft();

  get displayedTemplates(): readonly CommonParameterTemplate[] {
    const search = this.searchText.trim().toLocaleLowerCase();
    if (!search) return this.templates;
    return this.templates.filter((template) =>
      [
        template.templateCode,
        template.templateName,
        template.normalizedParameterName,
        template.dataSourceName ?? '',
      ].some((value) => value.toLocaleLowerCase().includes(search)),
    );
  }

  get isSqlLov(): boolean {
    return this.draft.valueSourceType === 'SqlLov';
  }

  ngOnInit(): void {
    this.loadDataSourceOptions();
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.isLoading = true;
    this.loadError = '';
    const isEnabled = this.enabledFilter === 'all'
      ? undefined
      : this.enabledFilter === 'enabled';

    this.api.getTemplates(isEnabled)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (templates) => (this.templates = templates),
        error: (error: unknown) => (this.loadError = this.getErrorMessage(error)),
      });
  }

  loadDataSourceOptions(): void {
    this.api.getDataSourceOptions().subscribe({
      next: (options) => {
        this.dataSourceOptions = options;
      },
      error: (error: unknown) => {
        this.loadError = this.getErrorMessage(error);
      },
    });
  }

  openCreateEditor(): void {
    this.editingTemplateId = null;
    this.draft = this.createEmptyDraft();
    this.editorError = '';
    this.isEditorOpen = true;
  }

  openEditEditor(template: CommonParameterTemplate): void {
    this.editingTemplateId = template.templateId;
    this.draft = {
      templateCode: template.templateCode,
      templateName: template.templateName,
      normalizedParameterName: template.normalizedParameterName,
      dataType: template.dataType,
      inputType: template.inputType,
      valueSourceType: template.valueSourceType,
      isRequired: template.isRequired,
      allowMultipleValues: template.allowMultipleValues,
      allowRangeValues: template.allowRangeValues,
      isVisible: template.isVisible,
      dataSourceId: template.dataSourceId,
      sqlQuery: template.sqlQuery,
      valueField: template.valueField,
      displayField: template.displayField,
      defaultValue: template.defaultValue,
      description: template.description,
    };
    this.editorError = '';
    this.isEditorOpen = true;
  }

  closeEditor(): void {
    if (this.isSaving) return;
    this.isEditorOpen = false;
    this.editorError = '';
  }

  onValueSourceChange(): void {
    if (this.isSqlLov) return;
    this.draft.dataSourceId = null;
    this.draft.sqlQuery = null;
    this.draft.valueField = null;
    this.draft.displayField = null;
  }

  saveTemplate(): void {
    const validationError = this.validateDraft();
    if (validationError) {
      this.editorError = validationError;
      return;
    }

    const request = this.normalizeDraft();
    const operation = this.editingTemplateId === null
      ? this.api.createTemplate(request)
      : this.api.updateTemplate(this.editingTemplateId, request);

    this.isSaving = true;
    this.editorError = '';
    operation.pipe(finalize(() => (this.isSaving = false))).subscribe({
      next: () => {
        this.isEditorOpen = false;
        this.loadTemplates();
      },
      error: (error: unknown) => (this.editorError = this.getErrorMessage(error)),
    });
  }

  setEnabled(template: CommonParameterTemplate, isEnabled: boolean): void {
    this.loadError = '';
    this.api.updateStatus(template.templateId, isEnabled).subscribe({
      next: () => this.loadTemplates(),
      error: (error: unknown) => (this.loadError = this.getErrorMessage(error)),
    });
  }

  trackByTemplateId(_: number, template: CommonParameterTemplate): number {
    return template.templateId;
  }

  private validateDraft(): string {
    if (!this.draft.templateCode.trim()) return '請輸入常用參數代碼。';
    if (!this.draft.templateName.trim()) return '請輸入常用參數名稱。';
    if (!this.draft.normalizedParameterName.trim()) return '請輸入匹配用參數名稱。';
    if (this.isSqlLov && !this.draft.dataSourceId) return 'SQL LOV 必須指定資料來源 ID。';
    if (this.isSqlLov && !this.draft.sqlQuery?.trim()) return 'SQL LOV 必須輸入查詢 SQL。';
    if (this.isSqlLov && !this.draft.valueField?.trim()) return 'SQL LOV 必須輸入值欄位。';
    if (this.isSqlLov && !this.draft.displayField?.trim()) return 'SQL LOV 必須輸入顯示欄位。';
    return '';
  }

  private normalizeDraft(): SaveCommonParameterTemplateRequest {
    const nullable = (value: string | null): string | null =>
      value?.trim() ? value.trim() : null;
    return {
      ...this.draft,
      templateCode: this.draft.templateCode.trim(),
      templateName: this.draft.templateName.trim(),
      normalizedParameterName: this.draft.normalizedParameterName.trim(),
      dataSourceId: this.isSqlLov ? this.draft.dataSourceId : null,
      sqlQuery: this.isSqlLov ? nullable(this.draft.sqlQuery) : null,
      valueField: this.isSqlLov ? nullable(this.draft.valueField) : null,
      displayField: this.isSqlLov ? nullable(this.draft.displayField) : null,
      defaultValue: nullable(this.draft.defaultValue),
      description: nullable(this.draft.description),
    };
  }

  private createEmptyDraft(): SaveCommonParameterTemplateRequest {
    return {
      templateCode: '',
      templateName: '',
      normalizedParameterName: '',
      dataType: 'String',
      inputType: 'Text',
      valueSourceType: 'UserInput',
      isRequired: true,
      allowMultipleValues: false,
      allowRangeValues: false,
      isVisible: true,
      dataSourceId: null,
      sqlQuery: null,
      valueField: null,
      displayField: null,
      defaultValue: null,
      description: null,
    };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return '你沒有設定常用參數的權限。';
      if (typeof error.error?.message === 'string') return error.error.message;
    }
    return '常用參數服務暫時無法使用，請稍後再試。';
  }
}
