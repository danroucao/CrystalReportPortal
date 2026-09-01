import { Injectable } from '@angular/core';

import {
  MockLovStatus,
  MockParameterOption,
  MockReportParameterDefinition,
  MockReportParameterDefinitions,
} from '../mock/mock-report-parameters';
import { MockReportKey } from '../mock/mock-reports';

@Injectable({ providedIn: 'root' })
export class MockReportParameterService {
  private readonly LovStatusOverrides = new Map<string, MockLovStatus>();

  GetDefinitions(ReportKey: MockReportKey): MockReportParameterDefinition[] {
    return MockReportParameterDefinitions[ReportKey].map((Definition) => ({
      ...Definition,
      Options: Definition.Options?.map((Option) => ({ ...Option })),
    }));
  }

  GetLovStatus(
    ReportKey: MockReportKey,
    ParameterName: string,
  ): MockLovStatus {
    return (
      this.LovStatusOverrides.get(this.GetLovStateKey(ReportKey, ParameterName)) ??
      this.GetDefinition(ReportKey, ParameterName)?.InitialLovStatus ??
      'success'
    );
  }

  GetLovOptions(
    ReportKey: MockReportKey,
    ParameterName: string,
  ): readonly MockParameterOption[] {
    if (this.GetLovStatus(ReportKey, ParameterName) !== 'success') return [];
    return this.GetDefinition(ReportKey, ParameterName)?.Options ?? [];
  }

  SetLovStatus(
    ReportKey: MockReportKey,
    ParameterName: string,
    Status: MockLovStatus,
  ): void {
    this.LovStatusOverrides.set(this.GetLovStateKey(ReportKey, ParameterName), Status);
  }

  RetryLov(ReportKey: MockReportKey, ParameterName: string): void {
    this.LovStatusOverrides.delete(this.GetLovStateKey(ReportKey, ParameterName));
  }

  private GetDefinition(
    ReportKey: MockReportKey,
    ParameterName: string,
  ): MockReportParameterDefinition | undefined {
    return MockReportParameterDefinitions[ReportKey].find(
      (Definition) => Definition.ParameterName === ParameterName,
    );
  }

  private GetLovStateKey(ReportKey: MockReportKey, ParameterName: string): string {
    return `${ReportKey}:${ParameterName}`;
  }
}
