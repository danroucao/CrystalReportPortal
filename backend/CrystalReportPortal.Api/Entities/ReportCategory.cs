namespace CrystalReportPortal.Api.Entities;

public class ReportCategory
{
    public int CategoryId { get; set; }

    public string CategoryName { get; set; } = null!;

    public string? Description { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }


    // Navigation Property
    public ICollection<Report> Reports { get; set; }
        = new List<Report>();
}