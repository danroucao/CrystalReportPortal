namespace CrystalReportPortal.Api.Entities;

public class RolePermission
{
    public int RoleId { get; set; }

    public int PermissionId { get; set; }

    public DateTime CreatedAt { get; set; }

    // Navigation Properties
    public Role Role { get; set; } = null!;

    public Permission Permission { get; set; } = null!;
}