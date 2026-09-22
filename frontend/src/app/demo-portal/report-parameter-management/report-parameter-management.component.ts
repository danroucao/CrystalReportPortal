import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MockReportKey } from '../../mock/mock-reports';
import { NotificationService } from '../../services/notification.service';
import { PortalTab, PortalTabsComponent } from '../../shared/portal-tabs.component';
import {
  MockManagedParameterDataType,
  MockManagedParameterInputType,
  MockManagedReportParameter,
  MockManagedReportParameterDraft,
  MockManagedReportParameterService,
} from '../../services/mock-managed-report-parameter.service';

type ManualParameterMode = 'report' | 'template';
type EditableParameterDraft = {
  -readonly [Key in keyof MockManagedReportParameterDraft]: MockManagedReportParameterDraft[Key];
};

@Component({
  selector: 'app-report-parameter-management',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalTabsComponent],
  templateUrl: './report-parameter-management.component.html',
  styleUrl: './report-parameter-management.component.scss',
})
export class ReportParameterManagementComponent implements OnInit, OnChanges {
  private readonly parametersApi = inject(MockManagedReportParameterService);
  private readonly notifications = inject(NotificationService);

  @Input({ required: true }) reportKey!: MockReportKey;
  @Input({ required: true }) reportName = '';
  @Input() detectedParameterNames: readonly string[] = [];
  @Output() readonly detectedParametersHandled = new EventEmitter<void>();

  readonly dataTypes: readonly MockManagedParameterDataType[] = ['String', 'Date', 'Number', 'Boolean'];
  readonly inputTypes: readonly MockManagedParameterInputType[] = [
    'Text', 'DatePicker', 'Number', 'Select', 'MultiSelect', 'Checkbox',
  ];
  readonly manualModeTabs: readonly PortalTab[] = [
    { id: 'report', label: '目前 RPT 參數' },
    { id: 'template', label: '共用參數範本' },
  ];

  parameters: MockManagedReportParameter[] = [];
  commonSelections: Record<string, 'none' | 'add' | 'common'> = {};
  isDetectedDialogOpen = false;
  detectedDisplayNames: Record<string, string> = {};
  isManualDialogOpen = false;
  manualMode: ManualParameterMode = 'report';
  manualError = '';
  saveError = '';
  pendingTemplateApply: MockManagedReportParameter | null = null;
  manualDraft = this.createManualDraft();

  get availableRptParameterNames(): readonly string[] {
    return this.parametersApi.GetAvailableRptParameterNames(this.reportKey);
  }

  ngOnInit(): void {
    this.loadParameters();
    this.openDetectedDialogIfNeeded();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reportKey'] && !changes['reportKey'].firstChange) {
      this.loadParameters();
    }
    if (changes['detectedParameterNames']) this.openDetectedDialogIfNeeded();
  }

  openManualDialog(): void {
    this.manualMode = 'report';
    this.manualError = '';
    this.manualDraft = this.createManualDraft();
    this.isManualDialogOpen = true;
  }

  closeManualDialog(): void {
    this.isManualDialogOpen = false;
    this.manualError = '';
  }

  setManualMode(mode: ManualParameterMode): void {
    this.manualMode = mode;
    this.manualError = '';
    this.manualDraft = this.createManualDraft();
  }

  setManualModeFromTab(mode: string): void {
    if (mode === 'report' || mode === 'template') this.setManualMode(mode);
  }

  updateParameterType(parameter: MockManagedReportParameter, value: string): void {
    parameter.DataType = value as MockManagedParameterDataType;
    parameter.InputType = this.defaultInputType(parameter.DataType);
  }

  updateManualType(value: string): void {
    this.manualDraft.DataType = value as MockManagedParameterDataType;
    this.manualDraft.InputType = this.defaultInputType(this.manualDraft.DataType);
  }

  saveParameters(): void {
    this.saveError = '';
    for (const parameter of this.parameters) {
      if (this.commonSelections[parameter.ParameterId] !== 'add') continue;
      const result = this.parametersApi.AddParameterToCommon(parameter);
      if (!result.Success) {
        this.saveError = `「${parameter.DisplayName}」${result.Error}`;
        continue;
      }
      parameter.CommonTemplateId = result.Template.TemplateId;
      parameter.CommonTemplateName = result.Template.DisplayName;
      this.commonSelections[parameter.ParameterId] = 'common';
    }
    this.parametersApi.SaveParameters(this.reportKey, this.parameters);
    if (!this.saveError) this.notifications.ShowSuccess('參數設定已儲存。');
  }

  saveDetectedParameters(): void {
    const Detected = new Set(this.detectedParameterNames);
    this.parameters.forEach((parameter) => {
      if (!Detected.has(parameter.ParameterName)) return;
      parameter.DisplayName = this.detectedDisplayNames[parameter.ParameterId]?.trim() || parameter.ParameterName;
      parameter.IsConfigured = true;
    });
    this.parametersApi.SaveParameters(this.reportKey, this.parameters);
    this.isDetectedDialogOpen = false;
    this.detectedParametersHandled.emit();
    this.notifications.ShowSuccess('新參數已加入目前報表，可在參數設定頁籤繼續調整。');
  }

  postponeDetectedParameters(): void {
    this.isDetectedDialogOpen = false;
    this.detectedParametersHandled.emit();
    this.notifications.ShowSuccess('已保留待設定的新參數；報表將維持待設定狀態。');
  }

  submitManualParameter(): void {
    const Draft = this.normalizedManualDraft();
    if (this.manualMode === 'template') {
      const result = this.parametersApi.AddCommonTemplate(Draft);
      if (!result.Success) {
        this.manualError = result.Error;
        return;
      }
      this.closeManualDialog();
      this.notifications.ShowSuccess(`已將「${result.Template.DisplayName}」加入常用參數。`);
      return;
    }

    const result = this.parametersApi.AddReportParameter(this.reportKey, Draft);
    if (!result.Success) {
      this.manualError = result.Error;
      return;
    }
    this.parameters = [...this.parameters, result.Parameter];
    this.commonSelections[result.Parameter.ParameterId] = 'none';
    this.closeManualDialog();
    this.notifications.ShowSuccess(`已新增參數「${result.Parameter.DisplayName}」。`);
  }

  getCommonSelection(parameter: MockManagedReportParameter): 'none' | 'add' | 'common' {
    return this.commonSelections[parameter.ParameterId] ?? (parameter.CommonTemplateName ? 'common' : 'none');
  }

  setCommonSelection(parameter: MockManagedReportParameter, value: string): void {
    if (parameter.CommonTemplateName) return;
    this.commonSelections[parameter.ParameterId] = value as 'none' | 'add';
  }

  matchingTemplateName(parameter: MockManagedReportParameter): string | null {
    return this.parametersApi.GetMatchingTemplate(parameter.ParameterName)?.DisplayName ?? null;
  }

  requestTemplateApply(parameter: MockManagedReportParameter): void {
    if (!this.matchingTemplateName(parameter) || parameter.CommonTemplateId) return;
    this.pendingTemplateApply = parameter;
  }

  cancelTemplateApply(): void {
    this.pendingTemplateApply = null;
  }

  confirmTemplateApply(): void {
    if (!this.pendingTemplateApply) return;
    const result = this.parametersApi.ApplyTemplate(
      this.reportKey,
      this.pendingTemplateApply.ParameterId,
    );
    if (!result.Success) {
      this.saveError = result.Error;
      this.pendingTemplateApply = null;
      return;
    }
    this.parameters = this.parameters.map((parameter) =>
      parameter.ParameterId === result.Parameter.ParameterId ? result.Parameter : parameter,
    );
    this.commonSelections[result.Parameter.ParameterId] = 'common';
    this.pendingTemplateApply = null;
    this.notifications.ShowSuccess('已套用共用參數範本。');
  }

  detachTemplate(parameter: MockManagedReportParameter): void {
    if (!parameter.CommonTemplateId) return;
    if (!this.parametersApi.DetachTemplate(this.reportKey, parameter.ParameterId)) return;
    parameter.CommonTemplateId = null;
    parameter.CommonTemplateName = null;
    this.commonSelections[parameter.ParameterId] = 'none';
    this.notifications.ShowSuccess('已解除共用參數關聯，保留目前報表設定。');
  }

  trackParameter(_: number, parameter: MockManagedReportParameter): string {
    return parameter.ParameterId;
  }

  getDetectedParameterId(parameterName: string): string {
    return this.parameters.find((parameter) => parameter.ParameterName === parameterName)?.ParameterId ?? '';
  }

  private loadParameters(): void {
    if (!this.reportKey) return;
    this.parameters = [...this.parametersApi.GetParameters(this.reportKey)];
    this.commonSelections = Object.fromEntries(
      this.parameters.map((parameter) => [
        parameter.ParameterId,
        parameter.CommonTemplateName ? 'common' : 'none',
      ]),
    );
    this.detectedDisplayNames = Object.fromEntries(
      this.parameters.map((parameter) => [parameter.ParameterId, parameter.DisplayName]),
    );
  }

  private openDetectedDialogIfNeeded(): void {
    if (!this.detectedParameterNames.length || !this.parameters.length) return;
    this.isDetectedDialogOpen = true;
  }

  private createManualDraft(): EditableParameterDraft {
    return {
      ParameterName: this.availableRptParameterNames[0] ?? '',
      DisplayName: '',
      DataType: 'String',
      InputType: 'Text',
      Required: false,
      Visible: true,
      DefaultValue: '',
      Description: '',
    };
  }

  private normalizedManualDraft(): MockManagedReportParameterDraft {
    return {
      ...this.manualDraft,
      ParameterName: this.manualDraft.ParameterName.trim(),
      DisplayName: this.manualDraft.DisplayName.trim() || this.manualDraft.ParameterName.trim(),
      DefaultValue: this.manualDraft.DefaultValue.trim(),
      Description: this.manualDraft.Description.trim(),
    };
  }

  private defaultInputType(dataType: MockManagedParameterDataType): MockManagedParameterInputType {
    if (dataType === 'Date') return 'DatePicker';
    if (dataType === 'Number') return 'Number';
    if (dataType === 'Boolean') return 'Checkbox';
    return 'Text';
  }
}
