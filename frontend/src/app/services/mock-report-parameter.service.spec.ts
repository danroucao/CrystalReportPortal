import { TestBed } from '@angular/core/testing';

import { ReportParameterService } from './mock-report-parameter.service';

import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';

import {
  provideHttpClientTesting,
} from '@angular/common/http/testing';

// TODO: Replace with ReportService HTTP tests for parameters and SQL LOV.
xdescribe('ReportParameterService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });
  });

  it('provides per-report definitions without exposing SQL or connection details', () => {
    const Service = TestBed.inject(ReportParameterService);
    const Definitions = Service.GetDefinitions('AccountBalance');

    expect(Definitions.map((Definition) => Definition.ParameterName)).toEqual([
      'PostingDate',
      'CustomerCode',
      'UserCode@',
    ]);
    expect(Definitions[1].Options).toEqual([
      { Value: 'ALL', DisplayText: '全部客戶' },
      { Value: 'DEMO', DisplayText: 'Demo 客戶' },
    ]);
    expect(JSON.stringify(Definitions)).not.toContain('SqlQuery');
    expect(JSON.stringify(Definitions)).not.toContain('Credential');
  });

  it('models loading, success, empty, error, and retry for a SQL LOV', () => {
    const Service = TestBed.inject(ReportParameterService);

    expect(Service.GetLovStatus('AccountBalance', 'CustomerCode')).toBe('success');
    expect(Service.GetLovOptions('AccountBalance', 'CustomerCode')).toHaveSize(2);

    Service.SetLovStatus('AccountBalance', 'CustomerCode', 'loading');
    expect(Service.GetLovStatus('AccountBalance', 'CustomerCode')).toBe('loading');
    expect(Service.GetLovOptions('AccountBalance', 'CustomerCode')).toEqual([]);

    Service.SetLovStatus('AccountBalance', 'CustomerCode', 'empty');
    expect(Service.GetLovStatus('AccountBalance', 'CustomerCode')).toBe('empty');

    Service.SetLovStatus('AccountBalance', 'CustomerCode', 'error');
    expect(Service.GetLovStatus('AccountBalance', 'CustomerCode')).toBe('error');
    Service.RetryLov('AccountBalance', 'CustomerCode');
    expect(Service.GetLovStatus('AccountBalance', 'CustomerCode')).toBe('success');
  });
});
