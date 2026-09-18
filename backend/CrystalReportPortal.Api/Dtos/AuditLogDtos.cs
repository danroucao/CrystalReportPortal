namespace CrystalReportPortal.Api.Dtos;

public class AuditLogQueryRequest
{
    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 20;

    public long? UserId { get; set; }

    public long? ReportId { get; set; }

    public string? Action { get; set; }

    public string? Result { get; set; }

    public string? IpAddress { get; set; }

    public DateTime? FromUtc { get; set; }

    public DateTime? ToUtc { get; set; }
}

public class AuditLogDto
{
    public long AuditLogId { get; set; }

    public long? UserId { get; set; }

    public string? UserAccount { get; set; }

    public string? UserName { get; set; }

    public long? ReportId { get; set; }

    public string? ReportCode { get; set; }

    public string? ReportName { get; set; }

    public Guid? ExecutionId { get; set; }

    public long? PrinterId { get; set; }

    public string? PrinterName { get; set; }

    public string Action { get; set; } =
        string.Empty;

    public string Result { get; set; } =
        string.Empty;

    public string? Details { get; set; }

    public string? ErrorMessage { get; set; }

    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class AuditLogListResponse
{
    public int Page { get; set; }

    public int PageSize { get; set; }

    public int TotalCount { get; set; }

    public int TotalPages { get; set; }

    public List<AuditLogDto> Items { get; set; } =
        [];
}