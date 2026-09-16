namespace CrystalReportPortal.Api.Entities;

public class Permission
{
    public int PermissionId { get; set; }

    public string PermissionCode { get; set; } = string.Empty;

    public string PermissionName { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public ICollection<RolePermission> RolePermissions { get; set; }
        = new List<RolePermission>();
}