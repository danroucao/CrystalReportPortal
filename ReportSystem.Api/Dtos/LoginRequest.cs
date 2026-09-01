namespace ReportSystem.Api.Dtos;

public class LoginRequest
{
    public string EmployeeNo { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}