namespace CrystalReportPortal.Api.Dtos;

// 第一關：接收共用後台帳密
public class BackOfficeLoginRequest
{
    public string Account { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}

// 第一關成功後的回覆
public class BackOfficeLoginResponse
{
    public bool Success { get; set; }

    public string Message { get; set; } = string.Empty;

    public Guid? ChallengeId { get; set; }

    public DateTime? ExpiresAt { get; set; }
}

// 第二關：確認實際操作者
public class BackOfficeOperatorRequest
{
    public Guid ChallengeId { get; set; }

    public string Account { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}

// 第二關成功後的回覆
public class BackOfficeOperatorResponse
{
    public bool Success { get; set; }

    public string Message { get; set; } = string.Empty;

    public string? Token { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public BackOfficeOperatorDto? Operator { get; set; }
}

// 實際操作者資料
public class BackOfficeOperatorDto
{
    public long UserId { get; set; }

    public string EmployeeNo { get; set; } = string.Empty;

    public string Account { get; set; } = string.Empty;

    public string UserName { get; set; } = string.Empty;
}