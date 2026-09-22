import { ReportManagementPageComponent } from './report-management-page/report-management-page.component';
import {
  AuthService,
  ConfigureDemoPortalTestBed,
  LoginFrontManager,
  MockRbacService,
  Router,
  TestBed,
} from './testing/demo-portal.spec-helpers';

describe('ReportManagementPageComponent', () => {
  ConfigureDemoPortalTestBed();

  function createPage(): ReportManagementPageComponent {
    expect(LoginFrontManager(TestBed.inject(AuthService))).toBeTrue();
    const fixture = TestBed.createComponent(ReportManagementPageComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('filters, pins, sorts, and paginates managed reports in its own component', () => {
    const component = createPage();
    expect(component.PagedManagedReports).toHaveSize(10);

    const report = component.PagedManagedReports[1];
    component.ToggleReportManagementPin(report.ReportKey);
    expect(component.IsReportManagementPinned(report.ReportKey)).toBeTrue();
    expect(component.DisplayedManagedReports[0].ReportKey).toBe(report.ReportKey);

    component.ToggleReportManagementSort('ReportName');
    expect(component.GetReportManagementAriaSort('ReportName')).toBe('ascending');
    component.GoToReportManagementPage(999);
    expect(component.ReportManagementCurrentPage).toBe(component.ReportManagementTotalPages);
    component.SetReportManagementCategory('FINANCE');
    expect(component.ReportManagementCurrentPage).toBe(1);
  });

  it('opens parameter setup for newly detected RPT parameters after upload', () => {
    const component = createPage();
    const rbac = TestBed.inject(MockRbacService);
    component.OpenUploadReportDialog();
    component.ReportEditorDraft = {
      ReportName: 'New managed report',
      Description: 'A report saved by the management page',
      CategoryId: 'FINANCE',
      Enabled: true,
    };

    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: { item: () => new File(['mock'], 'NewManagedReport.rpt') },
    });
    component.OnReportFileSelected({ target: input } as unknown as Event);
    component.SaveReport();

    expect(rbac.Reports.some((report) => report.ReportName === 'New managed report')).toBeTrue();
    expect(component.IsUploadReportDialogOpen).toBeTrue();
    expect(component.ReportEditorTab).toBe('parameters');
    expect(component.DetectedParameterNames).toContain('ReportType');
  });

  it('opens a report detail route from the edit action instead of a modal', () => {
    const component = createPage();
    const router = TestBed.inject(Router);
    const report = component.PagedManagedReports[0];
    spyOn(router, 'navigate').and.resolveTo(true);

    component.OpenEditReportDialog(report.ReportKey);

    expect(router.navigate).toHaveBeenCalledWith(['/report-management/edit', report.ReportKey]);
    expect(component.IsUploadReportDialogOpen).toBeFalse();
  });

  it('creates a quick-add category without resetting the open report draft', () => {
    const component = createPage();
    component.OpenUploadReportDialog();
    component.ReportEditorDraft = {
      ReportName: 'Draft stays intact',
      Description: 'Draft description',
      CategoryId: 'FINANCE',
      Enabled: true,
    };
    component.OpenReportCategoryQuickAdd();
    component.QuickAddCategoryName = 'Test quick category';
    component.CreateReportCategoryQuickAdd();

    expect(component.IsUploadReportDialogOpen).toBeTrue();
    expect(component.IsReportCategoryQuickAddOpen).toBeFalse();
    expect(component.ReportEditorDraft.ReportName).toBe('Draft stays intact');
    expect(component.ReportEditorDraft.CategoryId).not.toBe('FINANCE');
  });

  it('deletes reports only through an explicit confirmation state', () => {
    const component = createPage();
    const rbac = TestBed.inject(MockRbacService);
    const report = component.PagedManagedReports[0];
    component.OpenDeleteReportDialog(report.ReportKey);
    expect(component.DeletingReport?.ReportKey).toBe(report.ReportKey);
    component.ConfirmDeleteReport();
    expect(rbac.GetReport(report.ReportKey)).toBeNull();
  });
});
