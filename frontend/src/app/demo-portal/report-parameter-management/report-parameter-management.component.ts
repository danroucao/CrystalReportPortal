import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MockReportKey } from '../../mock/mock-reports';
import { NotificationService } from '../../services/notification.service';
import { UnsavedChangesDialogComponent } from '../../shared/unsaved-changes-dialog.component';
import {
  MockManagedParameterDataType,
  MockManagedParameterInputType,
  MockManagedReportParameter,
  MockManagedReportParameterDraft,
  MockManagedReportParameterService,
} from '../../services/mock-managed-report-parameter.service';

@Component({
  selector: 'app-report-parameter-management',
  standalone: true,
  imports: [CommonModule, FormsModule, UnsavedChangesDialogComponent],
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
  @Output() readonly commonParameterManagementRequested = new EventEmitter<void>();

  readonly dataTypes: readonly MockManagedParameterDataType[] = ['String', 'Date', 'Number', 'Boolean'];
  readonly inputTypes: readonly MockManagedParameterInputType[] = [
    'Text', 'DatePicker', 'Number', 'Select', 'MultiSelect', 'Checkbox',
  ];
  parameters: readonly MockManagedReportParameter[] = [];
  expandedParameterId: string | null = null;
  isDetectedDialogOpen = false;
  isManualDialogOpen = false;
  isManualDiscardConfirmationOpen = false;
  manualDraft = this.createManualDraft();
  manualAddToCommon = false;
  manualError = '';
  private initialManualDraft: MockManagedReportParameterDraft | null = null;
  private initialManualAddToCommon = false;

  get availableRptParameterNames(): readonly string[] {
    return this.parametersApi.GetAvailableRptParameterNames(this.reportKey);
  }

  ngOnInit(): void {
    this.loadParameters();
    this.openDetectedDialogIfNeeded();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reportKey'] && !changes['reportKey'].firstChange) this.loadParameters();
    if (changes['detectedParameterNames']) this.openDetectedDialogIfNeeded();
  }

  openManualDialog(): void {
    this.manualError = '';
    this.manualDraft = this.createManualDraft();
    this.manualAddToCommon = false;
    this.initialManualDraft = { ...this.manualDraft };
    this.initialManualAddToCommon = this.manualAddToCommon;
    this.isManualDialogOpen = true;
  }

  requestCloseManualDialog(): void {
    if (!this.isManualDialogDirty()) {
      this.closeManualDialog();
      return;
    }
    this.isManualDiscardConfirmationOpen = true;
  }

  HasUnsavedChanges(): boolean {
    return this.isManualDialogOpen && this.isManualDialogDirty();
  }

  continueEditingManualParameter(): void {
    this.isManualDiscardConfirmationOpen = false;
  }

  discardManualParameterChanges(): void {
    this.closeManualDialog();
  }

  closeManualDialog(): void {
    this.isManualDialogOpen = false;
    this.isManualDiscardConfirmationOpen = false;
    this.initialManualDraft = null;
    this.initialManualAddToCommon = false;
    this.manualAddToCommon = false;
    this.manualError = '';
  }

  isParameterExpanded(parameterId: string): boolean {
    return this.expandedParameterId === parameterId;
  }

  toggleParameter(parameterId: string): void {
    this.expandedParameterId = this.expandedParameterId === parameterId ? null : parameterId;
  }

  getParameterTemplateStatus(parameter: MockManagedReportParameter): string {
    return parameter.CommonTemplateName ?? '尚未建立共用參數';
  }

  requestCommonParameterManagement(): void {
    this.commonParameterManagementRequested.emit();
  }

  acknowledgeDetectedParameters(): void {
    this.isDetectedDialogOpen = false;
    this.detectedParametersHandled.emit();
  }

  submitManualParameter(): void {
    const Draft = this.normalizedManualDraft();
    if (!Draft.DisplayName) {
      this.manualError = '請輸入顯示名稱。';
      return;
    }
    const AddToCommon = this.manualAddToCommon;
    const result = this.parametersApi.AddReportParameter(this.reportKey, Draft, AddToCommon);
    if (!result.Success) {
      this.manualError = result.Error;
      return;
    }
    this.parameters = [...this.parameters, result.Parameter];
    this.closeManualDialog();
    this.notifications.ShowSuccess(
      AddToCommon
        ? `已新增參數「${result.Parameter.DisplayName}」並加入共用參數。`
        : `已將「${result.Parameter.DisplayName}」加入目前報表。`,
    );
  }

  trackParameter(_: number, parameter: MockManagedReportParameter): string {
    return parameter.ParameterId;
  }

  private loadParameters(): void {
    if (!this.reportKey) return;
    this.parameters = this.parametersApi.SynchronizeParametersWithCommonTemplates(this.reportKey);
    if (
      this.expandedParameterId &&
      !this.parameters.some((parameter) => parameter.ParameterId === this.expandedParameterId)
    ) {
      this.expandedParameterId = null;
    }
  }

  private openDetectedDialogIfNeeded(): void {
    if (!this.detectedParameterNames.length) return;
    this.isDetectedDialogOpen = true;
  }

  private isManualDialogDirty(): boolean {
    return Boolean(
      this.initialManualDraft &&
      (
        JSON.stringify(this.initialManualDraft) !== JSON.stringify(this.manualDraft) ||
        this.initialManualAddToCommon !== this.manualAddToCommon
      ),
    );
  }

  updateManualType(value: string): void {
    this.manualDraft.DataType = value as MockManagedParameterDataType;
    this.manualDraft.InputType = this.defaultInputType(this.manualDraft.DataType);
  }

  private createManualDraft(): MockManagedReportParameterDraft {
    return {
      ParameterName: this.availableRptParameterNames[0] ?? '',
      DisplayName: '',
      DataType: 'String',
      InputType: 'Text',
      DefaultValue: '',
      Description: '',
    };
  }

  private normalizedManualDraft(): MockManagedReportParameterDraft {
    return {
      ...this.manualDraft,
      ParameterName: this.manualDraft.ParameterName.trim(),
      DisplayName: this.manualDraft.DisplayName.trim(),
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
