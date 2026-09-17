export type CommonParameterDataType =
  | 'String'
  | 'Date'
  | 'DateTime'
  | 'Number'
  | 'Boolean';

export type CommonParameterInputType =
  | 'Text'
  | 'DatePicker'
  | 'Select'
  | 'MultiSelect'
  | 'Hidden'
  | 'Number'
  | 'Checkbox';

export type CommonParameterValueSourceType =
  | 'UserInput'
  | 'SqlLov'
  | 'CurrentUser';

export interface CommonParameterTemplate {
  readonly templateId: number;
  readonly templateCode: string;
  readonly templateName: string;
  readonly normalizedParameterName: string;
  readonly dataType: CommonParameterDataType;
  readonly inputType: CommonParameterInputType;
  readonly valueSourceType: CommonParameterValueSourceType;
  readonly isRequired: boolean;
  readonly allowMultipleValues: boolean;
  readonly allowRangeValues: boolean;
  readonly isVisible: boolean;
  readonly dataSourceId: number | null;
  readonly dataSourceName: string | null;
  readonly sqlQuery: string | null;
  readonly valueField: string | null;
  readonly displayField: string | null;
  readonly defaultValue: string | null;
  readonly description: string | null;
  readonly isEnabled: boolean;
  readonly createdBy: number;
  readonly createdAt: string;
  readonly updatedBy: number | null;
  readonly updatedAt: string | null;
}

export interface SaveCommonParameterTemplateRequest {
  templateCode: string;
  templateName: string;
  normalizedParameterName: string;
  dataType: CommonParameterDataType;
  inputType: CommonParameterInputType;
  valueSourceType: CommonParameterValueSourceType;
  isRequired: boolean;
  allowMultipleValues: boolean;
  allowRangeValues: boolean;
  isVisible: boolean;
  dataSourceId: number | null;
  sqlQuery: string | null;
  valueField: string | null;
  displayField: string | null;
  defaultValue: string | null;
  description: string | null;
}
