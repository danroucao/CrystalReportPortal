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
});
