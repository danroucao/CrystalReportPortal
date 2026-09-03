using System.Text.Json.Serialization;

namespace CrystalReportPortal.Api.Dtos;

public class LoginResponse
{
    public bool Success { get; set; }

    public string Message { get; set; } = string.Empty;

    public bool PasswordExpired { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Token { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTime? ExpiresAt { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public LoginUserDto? User { get; set; }
}

public class LoginUserDto
{
    public long UserId { get; set; }

    public string Account { get; set; } = string.Empty;

    public string EmployeeNo { get; set; } = string.Empty;

    public string UserName { get; set; } = string.Empty;

    public List<string> Roles { get; set; } = [];
}

public class ChangePasswordRequest
{
    public string Account { get; set; } = string.Empty;

    public string CurrentPassword { get; set; } = string.Empty;

    public string NewPassword { get; set; } = string.Empty;
}