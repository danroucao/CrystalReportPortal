import { MockReportKey } from './mock-reports';

export type MockParameterDataType =
  | 'Date'
  | 'DateTime'
  | 'Text'
  | 'Integer'
  | 'Float'
  | 'Boolean';

export type MockParameterInputType =
  | 'Date'
  | 'DateTime'
  | 'Text'
  | 'LongText'
  | 'Number'
  | 'Checkbox'
  | 'SingleSelect'
  | 'MultiSelect';

export type MockParameterValueSourceType = 'None' | 'Static' | 'SqlLov';

export type MockLovStatus = 'loading' | 'success' | 'empty' | 'error';

export interface MockParameterOption {
  readonly Value: string;
  readonly DisplayText: string;
}

export interface MockRangeDefaultValue {
  readonly Start: string | number | null;
  readonly End: string | number | null;
}

export type MockParameterDefaultValue =
  | string
  | number
  | boolean
  | readonly string[]
  | MockRangeDefaultValue
  | null;

export interface MockReportParameterDefinition {
  readonly ParameterName: string;
  readonly DisplayName: string;
  readonly DataType: MockParameterDataType;
  readonly InputType: MockParameterInputType;
  readonly ValueSourceType: MockParameterValueSourceType;
  readonly IsRequired: boolean;
  readonly AllowMultipleValues: boolean;
  readonly AllowRangeValues: boolean;
  readonly IsVisible: boolean;
  readonly DefaultValue: MockParameterDefaultValue;
  readonly DisplayOrder: number;
  readonly Options?: readonly MockParameterOption[];
  readonly InitialLovStatus?: MockLovStatus;
}

export type MockReportParameterDefinitions = Readonly<
  Partial<Record<MockReportKey, readonly MockReportParameterDefinition[]>>
>;

const CustomerOptions: readonly MockParameterOption[] = [
  { Value: 'ALL', DisplayText: '全部客戶' },
  { Value: 'DEMO', DisplayText: 'Demo 客戶' },
];

const ItemOptions: readonly MockParameterOption[] = [
  { Value: 'A-100', DisplayText: 'A-100 原料' },
  { Value: 'B-200', DisplayText: 'B-200 半成品' },
  { Value: 'C-300', DisplayText: 'C-300 成品' },
];

export const MockReportParameterDefinitions: MockReportParameterDefinitions = {
  AccountBalance: [
    {
      ParameterName: 'PostingDate',
      DisplayName: '日期區間',
      DataType: 'Date',
      InputType: 'Date',
      ValueSourceType: 'None',
      IsRequired: true,
      AllowMultipleValues: false,
      AllowRangeValues: true,
      IsVisible: true,
      DefaultValue: { Start: '', End: '' },
      DisplayOrder: 20,
    },
    {
      ParameterName: 'CustomerCode',
      DisplayName: '客戶',
      DataType: 'Text',
      InputType: 'SingleSelect',
      ValueSourceType: 'SqlLov',
      IsRequired: true,
      AllowMultipleValues: false,
      AllowRangeValues: false,
      IsVisible: true,
      DefaultValue: 'ALL',
      DisplayOrder: 30,
      Options: CustomerOptions,
    },
    {
      ParameterName: 'UserCode@',
      DisplayName: '執行登入者',
      DataType: 'Text',
      InputType: 'Text',
      ValueSourceType: 'None',
      IsRequired: false,
      AllowMultipleValues: false,
      AllowRangeValues: false,
      IsVisible: false,
      DefaultValue: null,
      DisplayOrder: 10,
    },
  ],
  MonthlyRevenue: [],
  Activity: [
    {
      ParameterName: 'ActivityAt',
      DisplayName: '活動時間',
      DataType: 'DateTime',
      InputType: 'DateTime',
      ValueSourceType: 'None',
      IsRequired: true,
      AllowMultipleValues: false,
      AllowRangeValues: false,
      IsVisible: true,
      DefaultValue: '',
      DisplayOrder: 10,
    },
    {
      ParameterName: 'Keyword',
      DisplayName: '關鍵字',
      DataType: 'Text',
      InputType: 'Text',
      ValueSourceType: 'None',
      IsRequired: true,
      AllowMultipleValues: false,
      AllowRangeValues: false,
      IsVisible: true,
      DefaultValue: '',
      DisplayOrder: 20,
    },
    {
      ParameterName: 'Memo',
      DisplayName: '備註',
      DataType: 'Text',
      InputType: 'LongText',
      ValueSourceType: 'None',
      IsRequired: false,
      AllowMultipleValues: false,
      AllowRangeValues: false,
      IsVisible: true,
      DefaultValue: '',
      DisplayOrder: 30,
    },
    {
      ParameterName: 'ResultLimit',
      DisplayName: '筆數上限',
      DataType: 'Integer',
      InputType: 'Number',
      ValueSourceType: 'None',
      IsRequired: true,
      AllowMultipleValues: false,
      AllowRangeValues: false,
      IsVisible: true,
      DefaultValue: 100,
      DisplayOrder: 40,
    },
    {
      ParameterName: 'MinimumAmount',
      DisplayName: '最小金額',
      DataType: 'Float',
      InputType: 'Number',
      ValueSourceType: 'None',
      IsRequired: false,
      AllowMultipleValues: false,
      AllowRangeValues: false,
      IsVisible: true,
      DefaultValue: 0.5,
      DisplayOrder: 50,
    },
    {
      ParameterName: 'IncludeInactive',
      DisplayName: '包含停用項目',
      DataType: 'Boolean',
      InputType: 'Checkbox',
      ValueSourceType: 'None',
      IsRequired: false,
      AllowMultipleValues: false,
      AllowRangeValues: false,
      IsVisible: true,
      DefaultValue: false,
      DisplayOrder: 60,
    },
  ],
  InventoryTransferHana: [
    {
      ParameterName: 'Warehouse',
      DisplayName: '倉庫',
      DataType: 'Text',
      InputType: 'SingleSelect',
      ValueSourceType: 'Static',
      IsRequired: true,
      AllowMultipleValues: false,
      AllowRangeValues: false,
      IsVisible: true,
      DefaultValue: 'MAIN',
      DisplayOrder: 10,
      Options: [
        { Value: 'MAIN', DisplayText: '主倉庫' },
        { Value: 'SECONDARY', DisplayText: '次要倉庫' },
      ],
    },
    {
      ParameterName: 'ItemCodes',
      DisplayName: '品項',
      DataType: 'Text',
      InputType: 'MultiSelect',
      ValueSourceType: 'SqlLov',
      IsRequired: true,
      AllowMultipleValues: true,
      AllowRangeValues: false,
      IsVisible: true,
      DefaultValue: [],
      DisplayOrder: 20,
      Options: ItemOptions,
    },
    {
      ParameterName: 'Quantity',
      DisplayName: '數量範圍',
      DataType: 'Integer',
      InputType: 'Number',
      ValueSourceType: 'None',
      IsRequired: true,
      AllowMultipleValues: false,
      AllowRangeValues: true,
      IsVisible: true,
      DefaultValue: { Start: 1, End: 100 },
      DisplayOrder: 30,
    },
  ],
  DocumentsV2WithSerialAndBatchDetails: [],
  ProductionOrder: [],
  ServiceContract: [],
};
