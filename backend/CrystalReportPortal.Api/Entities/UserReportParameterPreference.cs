namespace CrystalReportPortal.Api.Entities;

public class UserReportParameterPreference
{
    public long PreferenceId { get; set; }
    public long UserId { get; set; }
    public long ReportId { get; set; }
    public string PreferenceType { get; set; } = null!;
    public string ParametersJson { get; set; } = null!;
    public DateTime UpdatedAt { get; set; }
    public User User { get; set; } = null!;
    public Report Report { get; set; } = null!;
}
