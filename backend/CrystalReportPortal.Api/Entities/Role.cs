namespace CrystalReportPortal.Api.Entities;

public class Role
{
    public int RoleId { get; set; }

    public string RoleCode { get; set; } = null!;

    public string RoleName { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }


    // Navigation Properties
    public ICollection<UserRole> UserRoles { get; set; }
        = new List<UserRole>();

    public ICollection<RoleReportPermission> RoleReportPermissions { get; set; }
        = new List<RoleReportPermission>();
}