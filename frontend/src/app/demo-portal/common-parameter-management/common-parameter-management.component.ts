import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MockReportReadModel } from '../../mock/mock-reports';
import { NotificationService } from '../../services/notification.service';
import {
  MockManagedParameterDataType,
  MockManagedReportParameterDraft,
  MockManagedParameterInputType,
  MockManagedReportParameterService,
  MockParameterTemplate,
} from '../../services/mock-managed-report-parameter.service';

type EnabledFilter = 'all' | 'enabled' | 'disabled';

@Component({
  selector: 'app-common-parameter-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './common-parameter-management.component.html',
  styleUrl: './common-parameter-management.component.scss',
})
export class CommonParameterManagementComponent implements OnInit {
  private readonly parametersApi = inject(MockManagedReportParameterService);
  private readonly notifications = inject(NotificationService);

  readonly dataTypes: readonly MockManagedParameterDataType[] = [
    'String', 'Date', 'Number', 'Boolean',
  ];
  readonly inputTypes: readonly MockManagedParameterInputType[] = [
    'Text', 'DatePicker', 'Number', 'Select', 'MultiSelect', 'Checkbox',
  ];

  templates: readonly MockParameterTemplate[] = [];
  enabledFilter: EnabledFilter = 'all';
  searchText = '';
  actionError = '';
  isEditorOpen = false;
  editingTemplateId: string | null = null;
  editorError = '';
  draft = this.createDraft();
  selectedUsageTemplate: MockParameterTemplate | null = null;
  deletingTemplate: MockParameterTemplate | null = null;
  deleteError = '';
  private usageByTemplateId = new Map<string, readonly MockReportReadModel[]>();

  ngOnInit(): void {
    this.refresh();
  }

  get displayedTemplates(): readonly MockParameterTemplate[] {
    const search = this.searchText.trim().toLocaleLowerCase();
    return this.templates.filter((template) =>
      (this.enabledFilter === 'all' ||
        (this.enabledFilter === 'enabled' && template.Enabled) ||
        (this.enabledFilter === 'disabled' && !template.Enabled)) &&
      (!search ||
        [template.ParameterName, template.DisplayName, template.Description]
          .some((value) => value.toLocaleLowerCase().includes(search))),
    );
  }

  openCreateEditor(): void {
    this.editingTemplateId = null;
    this.draft = this.createDraft();
    this.editorError = '';
    this.isEditorOpen = true;
  }

  openEditEditor(template: MockParameterTemplate): void {
    this.editingTemplateId = template.TemplateId;
    this.draft = this.toDraft(template);
    this.editorError = '';
    this.isEditorOpen = true;
  }

  closeEditor(): void {
    this.isEditorOpen = false;
    this.editorError = '';
  }

  saveTemplate(): void {
    const draft = this.normalizedDraft();
    if (!draft.ParameterName) {
      this.editorError = '請輸入匹配用參數名稱。';
      return;
    }
    if (!draft.DisplayName) {
      this.editorError = '請輸入顯示名稱。';
      return;
    }
    const result = this.editingTemplateId
      ? this.parametersApi.UpdateTemplate(this.editingTemplateId, draft)
      : this.parametersApi.AddCommonTemplate(draft);
    if (!result.Success) {
      this.editorError = result.Error;
      return;
    }
    this.closeEditor();
    this.refresh();
    this.notifications.ShowSuccess(
      this.editingTemplateId ? '共用參數已更新。' : '共用參數已新增。',
    );
  }

  setTemplateEnabled(template: MockParameterTemplate, enabled: boolean): void {
    this.actionError = '';
    if (!this.parametersApi.SetTemplateEnabled(template.TemplateId, enabled)) {
      this.actionError = '同一個匹配用參數名稱只能有一個啟用中的共用範本。';
      return;
    }
    this.refresh();
    this.notifications.ShowSuccess(enabled ? '共用參數已啟用。' : '共用參數已停用。');
  }

  usageFor(template: MockParameterTemplate): readonly MockReportReadModel[] {
    return this.usageByTemplateId.get(template.TemplateId) ?? [];
  }

  openUsage(template: MockParameterTemplate): void {
    this.selectedUsageTemplate = template;
  }

  closeUsage(): void {
    this.selectedUsageTemplate = null;
  }

  openDeleteDialog(template: MockParameterTemplate): void {
    this.deletingTemplate = template;
    this.deleteError = '';
  }

  closeDeleteDialog(): void {
    this.deletingTemplate = null;
    this.deleteError = '';
  }

  confirmDelete(): void {
    if (!this.deletingTemplate) return;
    const result = this.parametersApi.DeleteTemplate(this.deletingTemplate.TemplateId);
    if (!result.Success) {
      this.deleteError = result.Error;
      this.refresh();
      return;
    }
    this.closeDeleteDialog();
    this.refresh();
    this.notifications.ShowSuccess('共用參數已刪除。');
  }

  updateDraftType(value: string): void {
    this.draft.DataType = value as MockManagedParameterDataType;
    this.draft.InputType = this.defaultInputType(this.draft.DataType);
  }

  trackTemplate(_: number, template: MockParameterTemplate): string {
    return template.TemplateId;
  }

  private refresh(): void {
    this.templates = this.parametersApi.GetTemplates();
    this.usageByTemplateId = new Map(
      this.templates.map((template) => [
        template.TemplateId,
        this.parametersApi.GetTemplateUsage(template.TemplateId),
      ]),
    );
  }

  private createDraft(): MockManagedReportParameterDraft {
    return {
      ParameterName: '', DisplayName: '', DataType: 'String', InputType: 'Text',
      Required: false, Visible: true, DefaultValue: '', Description: '',
    };
  }

  private toDraft(template: MockParameterTemplate): MockManagedReportParameterDraft {
    return {
      ParameterName: template.ParameterName,
      DisplayName: template.DisplayName,
      DataType: template.DataType,
      InputType: template.InputType,
      Required: template.Required,
      Visible: template.Visible,
      DefaultValue: template.DefaultValue,
      Description: template.Description,
    };
  }

  private normalizedDraft(): MockManagedReportParameterDraft {
    return {
      ...this.draft,
      ParameterName: this.draft.ParameterName.trim(),
      DisplayName: this.draft.DisplayName.trim(),
      DefaultValue: this.draft.DefaultValue.trim(),
      Description: this.draft.Description.trim(),
    };
  }

  private defaultInputType(dataType: MockManagedParameterDataType): MockManagedParameterInputType {
    if (dataType === 'Date') return 'DatePicker';
    if (dataType === 'Number') return 'Number';
    if (dataType === 'Boolean') return 'Checkbox';
    return 'Text';
  }
}
