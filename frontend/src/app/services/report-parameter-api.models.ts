export interface ReportParameterResponse {
  parameterId: number;
  name: string;
  displayName: string;
  dataType: string;
  inputType: string;
  required: boolean;
  multiple: boolean;
  range: boolean;
  valueSource: string;
  visible: boolean;
  defaultValue: string | null;
  displayOrder: number;
}

export interface ReportParameterListResponse {
  success: boolean;
  data: ReportParameterResponse[];
}

export interface ReportParameterOptionResponse {
  value: string;
  label: string;
}

export interface ReportParameterOptionsResponse {
  success: boolean;
  data: ReportParameterOptionResponse[];
}
