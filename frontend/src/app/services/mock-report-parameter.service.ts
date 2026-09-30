import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { MockLovStatus, MockParameterDataType, MockParameterInputType, MockParameterOption, MockReportParameterDefinition } from '../mock/mock-report-parameters';
import { MockReportKey } from '../mock/mock-reports';
import { API_BASE_URL } from './api.config';
import { ReportParameterListResponse, ReportParameterOptionsResponse, ReportParameterResponse } from './report-parameter-api.models';

@Injectable({ providedIn: 'root' })
// Despite the legacy file name, this service loads definitions and LOV options
// from the front-office report APIs.  Keep the implementation here while the
// remaining Stage 3 mock types are migrated separately.
export class ReportParameterService {
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
      DefaultValue: this.MapDefaultValue(Item), DisplayOrder: Item.displayOrder,
      Options: [], InitialLovStatus: Item.valueSource === 'SqlLov' ? 'loading' : 'success' };
  }
  private MapDataType(Value: string): MockParameterDataType {
    const mapped: Record<string, MockParameterDataType> = {
      String: 'Text', Text: 'Text', Date: 'Date', DateTime: 'DateTime',
      Number: 'Float', Integer: 'Integer', Float: 'Float', Boolean: 'Boolean',
    };
    return mapped[Value] ?? 'Text';
  }
  private MapInputType(Value: string): MockParameterInputType {
    return ({ DatePicker: 'Date', DateTimePicker: 'DateTime', Text: 'Text', TextArea: 'LongText', Number: 'Number', Checkbox: 'Checkbox', Select: 'SingleSelect', SingleSelect: 'SingleSelect', MultiSelect: 'MultiSelect' } as Record<string, MockParameterInputType>)[Value] ?? 'Text';
  }

  private MapDefaultValue(Item: ReportParameterResponse): MockReportParameterDefinition['DefaultValue'] {
    const raw = Item.defaultValue?.trim();
    if (!raw) return Item.multiple ? [] : Item.dataType === 'Boolean' ? false : '';

    if (Item.multiple) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) return parsed;
      } catch {
        // Support legacy comma- or semicolon-separated default values.
      }
      return raw.split(/[;,]/).map((value) => value.trim()).filter(Boolean);
    }

    if (Item.range) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
          'Start' in parsed && 'End' in parsed) {
          const range = parsed as { Start: unknown; End: unknown };
          if ((typeof range.Start === 'string' || typeof range.Start === 'number' || range.Start === null) &&
            (typeof range.End === 'string' || typeof range.End === 'number' || range.End === null)) {
            return { Start: range.Start, End: range.End };
          }
        }
      } catch {
        // Support the concise start,end form in existing templates.
      }
      const [start = null, end = null] = raw.split(',', 2).map((value) => value.trim() || null);
      return { Start: start, End: end };
    }

    if (Item.dataType === 'Boolean') return raw.toLowerCase() === 'true';
    if (Item.dataType === 'Number') {
      const value = Number(raw);
      return Number.isFinite(value) ? value : '';
    }
    return raw;
  }
  private Key(ReportKey: MockReportKey, ParameterName: string): string { return `${ReportKey}:${ParameterName}`; }
}
