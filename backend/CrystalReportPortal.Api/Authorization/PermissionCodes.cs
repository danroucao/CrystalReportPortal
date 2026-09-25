namespace CrystalReportPortal.Api.Authorization;

public static class PermissionCodes
{
    public const string ReportUpload =
        "Report.Upload";

    public const string ReportMaintain =
        "Report.Maintain";

    public const string ReportSetParameters =
        "Report.SetParameters";

    public const string ReportEnableDisable =
        "Report.EnableDisable";

    public const string ReportViewArchive =
        "Report.ViewArchive";

    public const string DataSourceManage =
        "DataSource.Manage";

    public const string AuditLogView =
        "AuditLog.View";

    public const string AuditLogViewArchive =
        "AuditLog.ViewArchive";

    public static readonly IReadOnlyList<string> All =
    [
        ReportUpload,
        ReportMaintain,
        ReportSetParameters,
        ReportEnableDisable,
        ReportViewArchive,
        DataSourceManage,
        AuditLogView,
        AuditLogViewArchive
    ];
}
