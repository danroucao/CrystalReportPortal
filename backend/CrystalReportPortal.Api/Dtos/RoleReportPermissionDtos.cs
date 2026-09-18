namespace CrystalReportPortal.Api.Dtos;

public class UpdateRoleReportPermissionRequest
{
    public bool CanExecute { get; set; }

    public bool CanExport { get; set; }

    public bool CanPrint { get; set; }

    public bool CanUpload { get; set; }

    public bool CanMaintain { get; set; }

    public bool CanSetParameters { get; set; }

    public bool CanEnableDisable { get; set; }
}

public class RoleReportPermissionDto
{
    public int RoleId { get; set; }

    public string RoleCode { get; set; } = string.Empty;

    public string RoleName { get; set; } = string.Empty;

    public long ReportId { get; set; }

    public string ReportCode { get; set; } = string.Empty;

    public string ReportName { get; set; } = string.Empty;

    public bool CanExecute { get; set; }

    public bool CanExport { get; set; }

    public bool CanPrint { get; set; }

    public bool CanUpload { get; set; }

    public bool CanMaintain { get; set; }

    public bool CanSetParameters { get; set; }

    public bool CanEnableDisable { get; set; }
}