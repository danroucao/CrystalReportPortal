import { MockManagedReportParameterService } from './mock-managed-report-parameter.service';
import { MockRbacService } from './mock-rbac.service';

describe('MockManagedReportParameterService', () => {
  it('identifies parameters without a common template when an RPT is recognised', () => {
    const service = new MockManagedReportParameterService(new MockRbacService());

    const detected = service.RecognizeUploadedRptParameters('AccountBalance');

    expect(detected).toContain('DepartmentCode');
    expect(detected).toContain('ReportType');
    expect(detected).not.toContain('StartDate');
    expect(service.GetParameters('AccountBalance')).toHaveSize(6);
  });

  it('keeps a manually created template outside the current report parameter list', () => {
    const service = new MockManagedReportParameterService(new MockRbacService());
    const initialCount = service.GetParameters('MonthlyRevenue').length;

    const result = service.AddCommonTemplate({
      ParameterName: 'CustomerGroup',
      DisplayName: '客戶群組',
      DataType: 'String',
      InputType: 'Select',
      Required: false,
      Visible: true,
      DefaultValue: '',
      Description: '依客戶群組篩選。',
    });

    expect(result.Success).toBeTrue();
    expect(service.IsCommonParameter('CustomerGroup')).toBeTrue();
    expect(service.GetParameters('MonthlyRevenue')).toHaveSize(initialCount);
  });

  it('keeps a template source link without propagating later template edits', () => {
    const rbac = new MockRbacService();
    const service = new MockManagedReportParameterService(rbac);
    const report = rbac.Reports[0];
    const parameter = service.GetParameters(report.ReportKey)[0];
    const template = service.GetMatchingTemplate(parameter.ParameterName)!;

    expect(parameter.CommonTemplateId).toBe(template.TemplateId);
    expect(service.GetTemplateUsage(template.TemplateId)).toContain(jasmine.objectContaining({ ReportKey: report.ReportKey }));

    const update = service.UpdateTemplate(template.TemplateId, {
      ...template,
      DisplayName: '新的開始日期名稱',
    });

    expect(update.Success).toBeTrue();
    expect(service.GetParameters(report.ReportKey)[0].DisplayName).not.toBe('新的開始日期名稱');
    expect(service.DetachTemplate(report.ReportKey, parameter.ParameterId)).toBeTrue();
    expect(service.GetTemplateUsage(template.TemplateId)).not.toContain(jasmine.objectContaining({ ReportKey: report.ReportKey }));
  });
});
