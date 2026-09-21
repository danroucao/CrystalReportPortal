import { DemoPortalComponent } from './demo-portal.component';
import { FavoriteReportPageComponent } from './favorite-report-page/favorite-report-page.component';
import { ReportPreviewPageComponent } from './report-preview-page/report-preview-page.component';
import { ReportParameterPageComponent } from './report-parameter-page/report-parameter-page.component';
import {
  ActivatedRoute,
  AuthService,
  ConfigureDemoPortalTestBed,
  LoginFrontManager,
  MockRbacService,
  Router,
  TestBed,
} from './testing/demo-portal.spec-helpers';

describe('report catalog and extracted report pages', () => {
  ConfigureDemoPortalTestBed();

  it('filters, sorts, selects, and removes only the signed-in users favorite reports', () => {
    const auth = TestBed.inject(AuthService);
    const rbac = TestBed.inject(MockRbacService);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(LoginFrontManager(auth, false)).toBeTrue();
    for (const key of ['AccountBalance', 'Activity', 'ProductionOrder'] as const) {
      rbac.ToggleFavoriteReport('user@example.com', key);
    }
    rbac.ToggleFavoriteReport('warehouse@example.com', 'AccountBalance');

    const fixture = TestBed.createComponent(FavoriteReportPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.FavoriteReports).toHaveSize(3);
    expect(component.FavoriteReportCategories.map((category) => category.CategoryId))
      .toContain('FINANCE');
    component.SetFavoriteCategory('FINANCE');
    component.FavoriteSearchText = 'Account';
    expect(component.DisplayedFavoriteReports.map(({ Report }) => Report.ReportKey))
      .toEqual(['AccountBalance']);

    component.ToggleFavoriteReportNameSort();
    expect(component.GetFavoriteReportAriaSort('ReportName')).toBe('ascending');
    component.SelectReportByKey('AccountBalance');
    expect(auth.SelectedReport?.ReportKey).toBe('AccountBalance');
    expect(navigate).toHaveBeenCalledWith(['/reports/preview'], {
      state: { ReportPreviewOrigin: 'favorites' },
    });

    component.RemoveFavoriteReport(component.FavoriteReports[0]);
    expect(component.FavoriteReports).toHaveSize(2);
    expect(rbac.GetFavoriteReports('warehouse@example.com')).toHaveSize(1);
  });

  it('renders a standalone favorite empty state without a table header', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.Login('user@example.com', 'user123')).toBeTrue();
    const fixture = TestBed.createComponent(FavoriteReportPageComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.favorite-report-table')).toBeNull();
    expect(host.querySelectorAll('.favorite-report-table th')).toHaveSize(0);
    expect(host.querySelector('.favorite-empty-state')).not.toBeNull();
  });

  it('keeps report preview output controls and return navigation inside the preview page', () => {
    const auth = TestBed.inject(AuthService);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(LoginFrontManager(auth)).toBeTrue();
    auth.SelectReport('AccountBalance');

    const fixture = TestBed.createComponent(ReportPreviewPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.ToggleExportMenu();
    expect(component.IsExportMenuOpen).toBeTrue();
    component.SelectExportOption(component.ExportOptions[1]);
    expect(component.IsExportMenuOpen).toBeFalse();
    expect(component.MockNotice).toContain('Excel');

    component.ReportPreviewOrigin = 'favorites';
    component.ReturnToReportList();
    expect(navigate).toHaveBeenCalledWith(['/reports']);
  });

  it('keeps report search and parameter selection in the report-parameter page', () => {
    const auth = TestBed.inject(AuthService);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(LoginFrontManager(auth, false)).toBeTrue();

    const fixture = TestBed.createComponent(ReportParameterPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.ParameterReportSearchText = 'Account';
    expect(component.DisplayedParameterReports.map((report) => report.ReportKey))
      .toEqual(['AccountBalance']);
    component.SelectReportForPreview('AccountBalance');
    expect(auth.SelectedReport?.ReportKey).toBe('AccountBalance');
    expect(navigate).toHaveBeenCalledWith(
      ['/reports/preview'],
      jasmine.objectContaining({ state: jasmine.any(Object) }),
    );
  });
});
