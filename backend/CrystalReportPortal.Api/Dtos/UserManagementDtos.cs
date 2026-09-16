namespace CrystalReportPortal.Api.Dtos;

public class CreateUserRequest
{
    public string EmployeeNo { get; set; } = string.Empty;
    public string Account { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string InitialPassword { get; set; } = string.Empty;
    public List<string> RoleCodes { get; set; } = [];
    public bool IsEnabled { get; set; } = true;
}

public class ManagedUserDto
{
    public long UserId { get; set; }
    public string EmployeeNo { get; set; } = string.Empty;
    public string Account { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public List<string> RoleCodes { get; set; } = [];
}

public class RoleOptionDto
{
    public string RoleCode { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
}

public class UpdateUserRolesRequest
{
    public List<string> RoleCodes { get; set; } = [];
}

public class UpdateManagedUserRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(50)]
    public string EmployeeNo { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(255)]
    public string Account { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(100)]
    public string UserName { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required]
    public bool? IsEnabled { get; set; }
}

public class ResetUserPasswordRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(
        64, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}