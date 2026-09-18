namespace CrystalReportPortal.Api.Services;

public interface ICrystalExportProcessService
{
    Task<byte[]> ExportPdfAsync(CrystalExportProcessRequest request);
}

public class CrystalExportProcessRequest
{
    public string RptPath { get; set; } = string.Empty;
    public string OutputPath { get; set; } = string.Empty;
    public CrystalExportDatabase Database { get; set; } = new();
    public List<CrystalExportProcessParameter> Parameters { get; set; } = [];
    public bool UseSavedDataOnly { get; set; }
}

public class CrystalExportDatabase
{
    public string Server { get; set; } = string.Empty;
    public string Database { get; set; } = string.Empty;
    public bool IntegratedSecurity { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public class CrystalExportProcessParameter
{
    public string Name { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public List<string> Values { get; set; } = [];
}
