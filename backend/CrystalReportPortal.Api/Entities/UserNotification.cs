namespace CrystalReportPortal.Api.Entities;

public class UserNotification
{
    public long NotificationId { get; set; }
    public long RecipientUserId { get; set; }
    public string Title { get; set; } = null!;
    public string Summary { get; set; } = null!;
    public string Detail { get; set; } = null!;
    public string? TargetPath { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }

    public User Recipient { get; set; } = null!;
}
