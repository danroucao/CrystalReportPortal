import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { MockLovStatus, MockParameterDataType, MockParameterInputType, MockParameterOption, MockReportParameterDefinition } from '../mock/mock-report-parameters';
import { MockReportKey } from '../mock/mock-reports';
import { API_BASE_URL } from './api.config';
import { ReportParameterListResponse, ReportParameterOptionsResponse, ReportParameterResponse } from './report-parameter-api.models';

@Injectable({ providedIn: 'root' })
export class MockReportParameterService {
  private readonly Definitions = new Map<MockReportKey, MockReportParameterDefinition[]>();
  private readonly LovStatuses = new Map<string, MockLovStatus>();
  private readonly LovErrorMessages = new Map<string, string>();
  constructor(private readonly Http: HttpClient) {}

  LoadDefinitions(ReportId: number, ReportKey: MockReportKey): Observable<MockReportParameterDefinition[]> {
    return this.Http.get<ReportParameterListResponse>(`${API_BASE_URL}/Reports/${ReportId}/parameters`).pipe(
      map((Response) => Response.data.map((Item) => this.MapDefinition(Item))),
      switchMap((Definitions) => {
        this.Definitions.set(ReportKey, Definitions);
        const Lov = Definitions.filter((Item) => Item.ValueSourceType === 'SqlLov' && Item.ParameterId);
        if (!Lov.length) return of(this.GetDefinitions(ReportKey));
        return forkJoin(Lov.map((Item) => this.LoadOptions(ReportId, ReportKey, Item).pipe(catchError(() => of(null)))))
          .pipe(map(() => this.GetDefinitions(ReportKey)));
      }),
    );
  }

  GetDefinitions(ReportKey: MockReportKey): MockReportParameterDefinition[] {
    return (this.Definitions.get(ReportKey) ?? []).map((Item) => ({ ...Item, Options: Item.Options?.map((Option) => ({ ...Option })) }));
  }
  GetLovStatus(ReportKey: MockReportKey, ParameterName: string): MockLovStatus {
    return this.LovStatuses.get(this.Key(ReportKey, ParameterName)) ?? 'success';
  }
  GetLovOptions(ReportKey: MockReportKey, ParameterName: string): readonly MockParameterOption[] {
    if (this.GetLovStatus(ReportKey, ParameterName) !== 'success') return [];
    return this.GetDefinitions(ReportKey).find((Item) => Item.ParameterName === ParameterName)?.Options ?? [];
  }
  GetLovErrorMessage(ReportKey: MockReportKey, ParameterName: string): string {
    return this.LovErrorMessages.get(this.Key(ReportKey, ParameterName)) ?? '無法載入選項，請重試。';
  }
  SetLovStatus(ReportKey: MockReportKey, ParameterName: string, Status: MockLovStatus): void {
    this.LovStatuses.set(this.Key(ReportKey, ParameterName), Status);
  }
  RetryLov(ReportKey: MockReportKey, ParameterName: string): void {
    const Definition = this.Definitions.get(ReportKey)?.find((Item) => Item.ParameterName === ParameterName);
    const ReportId = Number(ReportKey);
    if (Definition?.ParameterId && Number.isFinite(ReportId)) this.LoadOptions(ReportId, ReportKey, Definition).subscribe();
  }

  private LoadOptions(ReportId: number, ReportKey: MockReportKey, Definition: MockReportParameterDefinition): Observable<unknown> {
    const Key = this.Key(ReportKey, Definition.ParameterName);
    this.LovStatuses.set(Key, 'loading');
    this.LovErrorMessages.delete(Key);
    return this.Http.get<ReportParameterOptionsResponse>(`${API_BASE_URL}/Reports/${ReportId}/parameters/${Definition.ParameterId}/options`).pipe(
      tap((Response) => {
        const Options = Response.data.map((Option) => ({ Value: Option.value, DisplayText: Option.label }));
        const Definitions = this.Definitions.get(ReportKey) ?? [];
        const Index = Definitions.findIndex((Item) => Item.ParameterName === Definition.ParameterName);
        if (Index >= 0) Definitions[Index] = { ...Definitions[Index], Options };
        this.LovStatuses.set(Key, Options.length ? 'success' : 'empty');
        this.LovErrorMessages.delete(Key);
      }),
      catchError((Error) => {
        this.LovStatuses.set(Key, 'error');

        const Message =
          Error?.error?.message ??
          Error?.error?.Message ??
          Error?.message ??
          '無法載入選項，請重試。';

        this.LovErrorMessages.set(
          Key,
          typeof Message === 'string' && Message.trim().length
            ? Message.trim()
            : '無法載入選項，請重試。',
        );

        return throwError(() => Error);
      }),
    );
  }

  private MapDefinition(Item: ReportParameterResponse): MockReportParameterDefinition {
    return { ParameterId: Item.parameterId, ParameterName: Item.name, DisplayName: Item.displayName,
      DataType: this.MapDataType(Item.dataType), InputType: this.MapInputType(Item.inputType),
      ValueSourceType: Item.valueSource === 'SqlLov' ? 'SqlLov' : 'None', IsRequired: Item.required,
      AllowMultipleValues: Item.multiple, AllowRangeValues: Item.range, IsVisible: Item.visible,
      DefaultValue: Item.multiple ? [] : Item.dataType === 'Boolean' ? false : '', DisplayOrder: Item.displayOrder,
      Options: [], InitialLovStatus: Item.valueSource === 'SqlLov' ? 'loading' : 'success' };
  }
  private MapDataType(Value: string): MockParameterDataType {
    const Allowed: MockParameterDataType[] = ['Date', 'DateTime', 'Text', 'Integer', 'Float', 'Boolean'];
    return Allowed.includes(Value as MockParameterDataType) ? Value as MockParameterDataType : 'Text';
  }
  private MapInputType(Value: string): MockParameterInputType {
    return ({ DatePicker: 'Date', DateTimePicker: 'DateTime', Text: 'Text', TextArea: 'LongText', Number: 'Number', Checkbox: 'Checkbox', SingleSelect: 'SingleSelect', MultiSelect: 'MultiSelect' } as Record<string, MockParameterInputType>)[Value] ?? 'Text';
  }
  private Key(ReportKey: MockReportKey, ParameterName: string): string { return `${ReportKey}:${ParameterName}`; }
}
