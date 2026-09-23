import { Injectable } from '@angular/core';

import { MockReportKey, MockReportReadModel } from '../mock/mock-reports';
import { MockRbacService } from './mock-rbac.service';

export type MockManagedParameterDataType = 'String' | 'Date' | 'Number' | 'Boolean';
export type MockManagedParameterInputType =
  | 'Text'
  | 'DatePicker'
  | 'Number'
  | 'Select'
  | 'MultiSelect'
  | 'Checkbox';

export interface MockManagedReportParameter {
  readonly ParameterId: string;
  readonly ParameterName: string;
  DisplayName: string;
  DataType: MockManagedParameterDataType;
  InputType: MockManagedParameterInputType;
  DefaultValue: string;
  Description: string;
  IsConfigured: boolean;
  CommonTemplateId: string | null;
  CommonTemplateName: string | null;
}

export interface MockManagedReportParameterDraft {
  ParameterName: string;
  DisplayName: string;
  DataType: MockManagedParameterDataType;
  InputType: MockManagedParameterInputType;
  DefaultValue: string;
  Description: string;
}

export interface MockCommonParameterDraft {
  ParameterName: string;
  DisplayName: string;
  DataType: MockManagedParameterDataType;
  InputType: MockManagedParameterInputType;
  DefaultValue: string;
  Description: string;
}

export interface MockParameterTemplate extends Readonly<MockCommonParameterDraft> {
  readonly TemplateId: string;
  readonly Enabled: boolean;
}

const RPT_PARAMETER_CANDIDATES: readonly MockManagedReportParameterDraft[] = [
  {
    ParameterName: 'StartDate', DisplayName: '報表起始日期', DataType: 'Date',
    InputType: 'DatePicker', DefaultValue: '', Description: '查詢開始日期。',
  },
  {
    ParameterName: 'EndDate', DisplayName: '報表結束日期', DataType: 'Date',
    InputType: 'DatePicker', DefaultValue: '', Description: '查詢結束日期。',
  },
  {
    ParameterName: 'DepartmentCode', DisplayName: '部門代碼', DataType: 'String',
    InputType: 'Select', DefaultValue: 'ALL', Description: '選擇要查詢的部門。',
  },
  {
    ParameterName: 'ReportType', DisplayName: '報表類型', DataType: 'String',
    InputType: 'Select', DefaultValue: '', Description: '選擇輸出報表類型。',
  },
  {
    ParameterName: 'Currency', DisplayName: '幣別', DataType: 'String',
    InputType: 'Select', DefaultValue: 'TWD', Description: '報表顯示的幣別。',
  },
  {
    ParameterName: 'IncludeInactive', DisplayName: '包含停用資料', DataType: 'Boolean',
    InputType: 'Checkbox', DefaultValue: 'false', Description: '是否包含已停用資料。',
  },
];

@Injectable({ providedIn: 'root' })
export class MockManagedReportParameterService {
  private readonly ParameterStore = new Map<MockReportKey, MockManagedReportParameter[]>();
  private readonly TemplateStore = new Map<string, MockParameterTemplate>();
  private NextParameterId = 1;
  private NextTemplateId = 1;

  constructor(private readonly mockRbac: MockRbacService) {
    this.CreateTemplate(this.ToCommonDraft(RPT_PARAMETER_CANDIDATES[0]));
    this.CreateTemplate(this.ToCommonDraft(RPT_PARAMETER_CANDIDATES[1]));
  }

  GetParameters(ReportKey: MockReportKey): readonly MockManagedReportParameter[] {
    return this.GetStoredParameters(ReportKey).map((Parameter) => ({ ...Parameter }));
  }

  SynchronizeParametersWithCommonTemplates(
    ReportKey: MockReportKey,
  ): readonly MockManagedReportParameter[] {
    const Parameters = this.GetStoredParameters(ReportKey);
    Parameters.forEach((Parameter, Index) => {
      if (Parameter.CommonTemplateId) return;
      const Template = this.GetEnabledTemplate(Parameter.ParameterName);
      if (!Template) return;
      Parameters[Index] = this.ApplyTemplateToParameter(Parameter, Template);
    });
    return Parameters.map((Parameter) => ({ ...Parameter }));
  }

  GetAvailableRptParameterNames(ReportKey: MockReportKey): readonly string[] {
    const ExistingNames = new Set(
      this.GetStoredParameters(ReportKey).map((Parameter) => Parameter.ParameterName),
    );
    return RPT_PARAMETER_CANDIDATES
      .map((Candidate) => Candidate.ParameterName)
      .filter((Name) => !ExistingNames.has(Name));
  }

  GetTemplates(): readonly MockParameterTemplate[] {
    return [...this.TemplateStore.values()]
      .map((Template) => ({ ...Template }))
      .sort((Left, Right) =>
        Left.DisplayName.localeCompare(Right.DisplayName, 'zh-Hant'),
      );
  }

  GetMatchingTemplate(ParameterName: string): MockParameterTemplate | null {
    const Template = this.GetEnabledTemplate(ParameterName);
    return Template ? { ...Template } : null;
  }

  GetTemplateUsage(TemplateId: string): readonly MockReportReadModel[] {
    return this.mockRbac.Reports.filter((Report) =>
      this.GetStoredParameters(Report.ReportKey).some(
        (Parameter) => Parameter.CommonTemplateId === TemplateId,
      ),
    );
  }

  UpdateTemplate(
    TemplateId: string,
    Draft: MockCommonParameterDraft,
  ): { Success: true; Template: MockParameterTemplate } | { Success: false; Error: string } {
    const Template = this.FindTemplateById(TemplateId);
    if (!Template) return { Success: false, Error: '找不到要編輯的共用參數。' };
    const ParameterName = Draft.ParameterName.trim();
    if (!ParameterName) return { Success: false, Error: '請輸入匹配用參數名稱。' };
    const Existing = this.GetEnabledTemplate(ParameterName);
    if (Template.Enabled && Existing && Existing.TemplateId !== TemplateId) {
      return { Success: false, Error: '相同名稱的共用參數已存在。' };
    }
    const Updated: MockParameterTemplate = {
      ...Draft,
      TemplateId,
      ParameterName,
      Enabled: Template.Enabled,
    };
    this.TemplateStore.set(TemplateId, Updated);
    return { Success: true, Template: { ...Updated } };
  }

  SetTemplateEnabled(TemplateId: string, Enabled: boolean): boolean {
    const Template = this.FindTemplateById(TemplateId);
    if (!Template) return false;
    if (Enabled) {
      const Existing = this.GetEnabledTemplate(Template.ParameterName);
      if (Existing && Existing.TemplateId !== TemplateId) return false;
    }
    this.TemplateStore.set(TemplateId, {
      ...Template,
      Enabled,
    });
    return true;
  }

  DeleteTemplate(TemplateId: string): { Success: true } | { Success: false; Error: string } {
    const Template = this.FindTemplateById(TemplateId);
    if (!Template) return { Success: false, Error: '找不到要刪除的共用參數。' };
    if (this.GetTemplateUsage(TemplateId).length) {
      return { Success: false, Error: '此共用參數仍有報表使用中，無法刪除。' };
    }
    this.TemplateStore.delete(TemplateId);
    return { Success: true };
  }

  ApplyTemplate(
    ReportKey: MockReportKey,
    ParameterId: string,
  ): { Success: true; Parameter: MockManagedReportParameter } | { Success: false; Error: string } {
    const Parameters = this.GetStoredParameters(ReportKey);
    const Parameter = Parameters.find((Item) => Item.ParameterId === ParameterId);
    if (!Parameter) return { Success: false, Error: '找不到要套用的報表參數。' };
    const Template = this.GetEnabledTemplate(Parameter.ParameterName);
    if (!Template) return { Success: false, Error: '找不到可套用的啟用共用參數。' };
    const Updated = this.ApplyTemplateToParameter(Parameter, Template);
    const Index = Parameters.findIndex((Item) => Item.ParameterId === ParameterId);
    Parameters[Index] = Updated;
    return { Success: true, Parameter: { ...Updated } };
  }

  DetachTemplate(ReportKey: MockReportKey, ParameterId: string): boolean {
    const Parameters = this.GetStoredParameters(ReportKey);
    const Index = Parameters.findIndex((Parameter) => Parameter.ParameterId === ParameterId);
    if (Index < 0) return false;
    Parameters[Index] = {
      ...Parameters[Index],
      CommonTemplateId: null,
      CommonTemplateName: null,
    };
    return true;
  }

  RecognizeUploadedRptParameters(ReportKey: MockReportKey): readonly string[] {
    const ExistingNames = new Set(
      (this.ParameterStore.get(ReportKey) ?? []).map((Parameter) => Parameter.ParameterName),
    );
    const Parameters = this.ParameterStore.get(ReportKey) ?? [];
    this.ParameterStore.set(ReportKey, Parameters);
    const Added: string[] = [];
    RPT_PARAMETER_CANDIDATES.forEach((Candidate) => {
      if (ExistingNames.has(Candidate.ParameterName)) return;
    const IsCommon = Boolean(this.GetEnabledTemplate(Candidate.ParameterName));
      Parameters.push(this.CreateParameter(Candidate, IsCommon));
      if (!IsCommon) {
        Added.push(Candidate.ParameterName);
      }
    });
    return Added;
  }

  SaveParameters(
    ReportKey: MockReportKey,
    Parameters: readonly MockManagedReportParameter[],
  ): void {
    this.ParameterStore.set(
      ReportKey,
      Parameters.map((Parameter) => ({ ...Parameter })),
    );
  }

  AddReportParameter(
    ReportKey: MockReportKey,
    Draft: MockManagedReportParameterDraft,
    AddToCommon = false,
  ): { Success: true; Parameter: MockManagedReportParameter } | { Success: false; Error: string } {
    const Name = Draft.ParameterName.trim();
    if (!Name) return { Success: false, Error: '請選擇 RPT 參數名稱。' };
    if (!this.GetAvailableRptParameterNames(ReportKey).includes(Name)) {
      return { Success: false, Error: '此參數已存在，或不在目前 RPT 的可用參數中。' };
    }
    if (AddToCommon && this.GetEnabledTemplate(Name)) {
      return { Success: false, Error: '相同名稱的共用參數已存在，請取消勾選或改由共用參數管理調整。' };
    }
    if (AddToCommon) {
      this.CreateTemplate(this.ToCommonDraft({ ...Draft, ParameterName: Name }));
    }
    const Parameter = this.CreateParameter({ ...Draft, ParameterName: Name }, true);
    this.GetStoredParameters(ReportKey).push(Parameter);
    return { Success: true, Parameter: { ...Parameter } };
  }

  AddCommonTemplate(
    Draft: MockCommonParameterDraft,
  ): { Success: true; Template: MockParameterTemplate } | { Success: false; Error: string } {
    const Name = Draft.ParameterName.trim();
    if (!Name) return { Success: false, Error: '請輸入參數名稱。' };
    if (this.GetEnabledTemplate(Name)) {
      return { Success: false, Error: '相同名稱的常用參數已存在。' };
    }
    return { Success: true, Template: this.CreateTemplate({ ...Draft, ParameterName: Name }) };
  }

  AddParameterToCommon(
    Parameter: MockManagedReportParameter,
  ): { Success: true; Template: MockParameterTemplate } | { Success: false; Error: string } {
    const Existing = this.GetEnabledTemplate(Parameter.ParameterName);
    if (Existing) return { Success: false, Error: '相同名稱的常用參數已存在。' };
    const Template = this.CreateTemplate(this.ToCommonDraft(Parameter));
    return { Success: true, Template };
  }

  IsCommonParameter(ParameterName: string): boolean {
    return Boolean(this.GetEnabledTemplate(ParameterName));
  }

  private GetStoredParameters(ReportKey: MockReportKey): MockManagedReportParameter[] {
    let Parameters = this.ParameterStore.get(ReportKey);
    if (!Parameters) {
      Parameters = RPT_PARAMETER_CANDIDATES.slice(0, 3).map((Candidate) =>
        this.CreateParameter(Candidate, true),
      );
      this.ParameterStore.set(ReportKey, Parameters);
    }
    return Parameters;
  }

  private CreateParameter(
    Draft: MockManagedReportParameterDraft,
    IsConfigured: boolean,
  ): MockManagedReportParameter {
    const Template = this.GetEnabledTemplate(Draft.ParameterName);
    return {
      ParameterId: `PARAM_${this.NextParameterId++}`,
      ...Draft,
      ParameterName: Draft.ParameterName.trim(),
      DisplayName: Template?.DisplayName ?? Draft.DisplayName,
      DataType: Template?.DataType ?? Draft.DataType,
      InputType: Template?.InputType ?? Draft.InputType,
      DefaultValue: Template?.DefaultValue ?? Draft.DefaultValue,
      Description: Template?.Description ?? Draft.Description,
      IsConfigured,
      CommonTemplateId: Template?.TemplateId ?? null,
      CommonTemplateName: Template?.DisplayName ?? null,
    };
  }

  private CreateTemplate(Draft: MockCommonParameterDraft): MockParameterTemplate {
    const Template: MockParameterTemplate = {
      TemplateId: `COMMON_${this.NextTemplateId++}`,
      ...Draft,
      ParameterName: Draft.ParameterName.trim(),
      Enabled: true,
    };
    this.TemplateStore.set(Template.TemplateId, Template);
    return { ...Template };
  }

  private NormalizeName(Name: string): string {
    return Name.trim().toLocaleLowerCase();
  }

  private FindTemplateById(TemplateId: string): MockParameterTemplate | undefined {
    return this.TemplateStore.get(TemplateId);
  }

  private GetEnabledTemplate(ParameterName: string): MockParameterTemplate | undefined {
    return [...this.TemplateStore.values()].find(
      (Template) =>
        Template.Enabled &&
        this.NormalizeName(Template.ParameterName) === this.NormalizeName(ParameterName),
    );
  }

  private ApplyTemplateToParameter(
    Parameter: MockManagedReportParameter,
    Template: MockParameterTemplate,
  ): MockManagedReportParameter {
    return {
      ...Parameter,
      DisplayName: Template.DisplayName,
      DataType: Template.DataType,
      InputType: Template.InputType,
      DefaultValue: Template.DefaultValue,
      Description: Template.Description,
      IsConfigured: true,
      CommonTemplateId: Template.TemplateId,
      CommonTemplateName: Template.DisplayName,
    };
  }

  private ToCommonDraft(
    Draft: Pick<
      MockManagedReportParameterDraft,
      'ParameterName' | 'DisplayName' | 'DataType' | 'InputType' | 'DefaultValue' | 'Description'
    >,
  ): MockCommonParameterDraft {
    return {
      ParameterName: Draft.ParameterName,
      DisplayName: Draft.DisplayName,
      DataType: Draft.DataType,
      InputType: Draft.InputType,
      DefaultValue: Draft.DefaultValue,
      Description: Draft.Description,
    };
  }
}
