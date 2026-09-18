namespace CrystalReportPortal.Api.Dtos;

public class CrystalLovRequest
{
    public CrystalDatabaseTestRequest Database { get; set; } = new();

    public string SqlQuery { get; set; } = string.Empty;

    public string ValueField { get; set; } = string.Empty;

    public string DisplayField { get; set; } = string.Empty;

    public int MaxRows { get; set; } = 1000;
}

public class CrystalLovOption
{
    public string Value { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;
}

public class CrystalLovResponse
{
    public bool Success { get; set; }

    public string? Message { get; set; }

    public int Count { get; set; }

    public List<CrystalLovOption> Options { get; set; } = [];
}