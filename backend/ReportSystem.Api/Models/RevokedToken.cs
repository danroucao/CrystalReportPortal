namespace ReportSystem.Api.Models;

public class RevokedToken
{
    public string Jti { get; set; } = string.Empty;

    public long UserId { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime RevokedAt { get; set; }
}
