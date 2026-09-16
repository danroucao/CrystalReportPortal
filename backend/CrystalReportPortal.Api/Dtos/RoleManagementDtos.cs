using System.ComponentModel.DataAnnotations;

namespace CrystalReportPortal.Api.Dtos;

public class CreateRoleRequest
{
    [Required]
    [StringLength(50)]
    public string RoleCode { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string RoleName { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }

    public bool IsEnabled { get; set; } = true;
}

public class UpdateRoleRequest
{
    [Required]
    [StringLength(100)]
    public string RoleName { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }

    public bool IsEnabled { get; set; } = true;
}

public class UpdateRolePermissionsRequest
{
    [Required]
    public List<string> PermissionCodes { get; set; } = [];
}