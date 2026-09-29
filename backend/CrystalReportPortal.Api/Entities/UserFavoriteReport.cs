namespace CrystalReportPortal.Api.Entities;

public class UserFavoriteReport
{
    public long UserFavoriteReportId { get; set; }
    public long UserId { get; set; }
    public long ReportId { get; set; }
    public DateTime FavoritedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }

    public User User { get; set; } = null!;
    public Report Report { get; set; } = null!;
}
