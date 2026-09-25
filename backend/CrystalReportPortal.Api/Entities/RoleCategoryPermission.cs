namespace CrystalReportPortal.Api.Entities;

/// <summary>
/// Default front-office permissions for every report in a category.
/// A RoleReportPermission, when present, is a more specific override.
/// </summary>
public class RoleCategoryPermission
{
    public int RoleId { get; set; }

    public int CategoryId { get; set; }

    public bool CanExecute { get; set; }

    public bool CanExport { get; set; }

    public bool CanPrint { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public Role Role { get; set; } = null!;

    public ReportCategory Category { get; set; } = null!;
}
