namespace CrystalReportPortal.Api.Entities;

public class Printer
{
    public long PrinterId { get; set; }

    public string PrinterName { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }


    // Navigation Property
    public ICollection<AuditLog> AuditLogs { get; set; }
        = new List<AuditLog>();
}