import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CreateManagedReportRequest } from './managed-report-api.models';
import { ReportService } from './report.service';

describe('ReportService managed-report upload', () => {
  let service: ReportService;
  let httpTesting: HttpTestingController;

  const request: CreateManagedReportRequest = {
    reportCode: 'SALES_DETAIL',
    reportName: 'Sales detail',
    description: 'Sales detail report',
    categoryId: 1,
    dataSourceId: null,
    credentialType: 'ReadOnly',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ReportService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('creates and uploads only when publication is requested', () => {
    let resultFileName = '';
    service.CreateManagedReportWithRpt(
      request,
      new File(['report'], 'sales.rpt'),
    ).subscribe((result) => (resultFileName = result.data.fileName));

    const create = httpTesting.expectOne(
      'http://localhost:5181/api/backoffice/reports',
    );
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(request);
    create.flush({ reportId: 7 });

    const upload = httpTesting.expectOne(
      'http://localhost:5181/api/Reports/7/rpt',
    );
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body instanceof FormData).toBeTrue();
    upload.flush({
      success: true,
      message: 'Uploaded',
      data: { reportId: 7, fileName: 'sales.rpt', parameterCount: 0, parameters: [] },
    });

    expect(resultFileName).toBe('sales.rpt');
  });

  it('deletes the newly created report when RPT upload fails', () => {
    let receivedError: unknown;
    service.CreateManagedReportWithRpt(
      request,
      new File(['report'], 'sales.rpt'),
    ).subscribe({ error: (error: unknown) => (receivedError = error) });

    httpTesting.expectOne('http://localhost:5181/api/backoffice/reports')
      .flush({ reportId: 8 });
    httpTesting.expectOne('http://localhost:5181/api/Reports/8/rpt')
      .flush({ message: 'Upload failed' }, { status: 500, statusText: 'Error' });

    const cleanup = httpTesting.expectOne(
      'http://localhost:5181/api/backoffice/reports/8',
    );
    expect(cleanup.request.method).toBe('DELETE');
    cleanup.flush(null);

    expect(receivedError).toBeTruthy();
  });

  it('reads the signed-in user\'s favorite parameter preference', () => {
    let result: { parametersJson: string; updatedAt: string } | undefined;
    service.GetParameterPreference(7, 'favorite').subscribe((preference) => result = preference);

    const get = httpTesting.expectOne(
      'http://localhost:5181/api/reports/7/parameter-preferences/favorite',
    );
    expect(get.request.method).toBe('GET');
    get.flush({
      parametersJson: '{"StartDate":"2026-09-01","StoreCodes":["S01"]}',
      updatedAt: '2026-09-29T01:00:00Z',
    });

    expect(result?.parametersJson).toContain('StoreCodes');
    expect(result?.updatedAt).toBe('2026-09-29T01:00:00Z');
  });

  it('saves recent parameter values through the preference API', () => {
    const parametersJson = '{"StartDate":"2026-09-01","StoreCodes":["S01","S02"]}';
    let result: { parametersJson: string; updatedAt: string } | undefined;
    service.SaveParameterPreference(7, 'recent', parametersJson)
      .subscribe((preference) => result = preference);

    const save = httpTesting.expectOne(
      'http://localhost:5181/api/reports/7/parameter-preferences/recent',
    );
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ parametersJson });
    save.flush({ parametersJson, updatedAt: '2026-09-29T01:01:00Z' });

    expect(result?.parametersJson).toBe(parametersJson);
  });
});
