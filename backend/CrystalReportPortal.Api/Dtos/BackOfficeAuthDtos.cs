namespace CrystalReportPortal.Api.Dtos;

public class BackOfficeLoginRequest
{
    public string Account { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}

public class BackOfficeOperatorLoginRequest
{
    public string Account { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class BackOfficeLoginResponse
{
    public bool Success { get; set; }

    public string Message { get; set; } = string.Empty;
}

public class BackOfficeOperatorResponse
{
    public bool Success { get; set; }

    public string Message { get; set; } = string.Empty;

    public bool PasswordExpired { get; set; }

    public BackOfficeOperatorDto? Operator { get; set; }
}

// 實際操作者資料
public class BackOfficeOperatorDto
{
    public long UserId { get; set; }

    public string Account { get; set; } = string.Empty;

    public string UserName { get; set; } = string.Empty;
}