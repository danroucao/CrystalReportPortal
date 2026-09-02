namespace ReportSystem.Api.Dtos;

public class ReportListResponse
{
    public bool Success { get; set; } = true;

    public int Count => Reports.Count;

    public List<ReportDto> Reports { get; set; } = [];
}

public class ReportDto
{
    public long ReportId { get; set; }

    public string ReportCode { get; set; } = string.Empty;

    public string ReportName { get; set; } = string.Empty;

    public string? Description { get; set; }

    public ReportCategoryDto Category { get; set; } = new();

    public ReportPermissionDto Permissions { get; set; } = new();
}

public class ReportCategoryDto
{
    public int CategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;
}

public class ReportPermissionDto
{
    public bool CanExecute { get; set; }

    public bool CanExport { get; set; }

    public bool CanPrint { get; set; }
}
