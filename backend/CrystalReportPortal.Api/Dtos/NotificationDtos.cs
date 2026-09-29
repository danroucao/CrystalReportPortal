namespace CrystalReportPortal.Api.Dtos;

public class UserNotificationDto
{
    public long NotificationId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public string? TargetPath { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }
}
