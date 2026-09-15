namespace CrystalReportPortal.Api.Entities;

public class RoleReportPermission
{
    public int RoleId { get; set; }

    public long ReportId { get; set; }

    public bool CanExecute { get; set; }

    public bool CanExport { get; set; }

    public bool CanPrint { get; set; }

    public bool CanUpload { get; set; }

    public bool CanMaintain { get; set; }

    public bool CanSetParameters { get; set; }
        
    public bool CanEnableDisable { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }


    // Navigation Properties
    public Role Role { get; set; } = null!;

    public Report Report { get; set; } = null!;
}