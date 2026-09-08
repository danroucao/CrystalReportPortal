using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace CrystalReportPortal.Api.Services;

public class CrystalExportProcessService : ICrystalExportProcessService
{
    private readonly IConfiguration configuration;

    public CrystalExportProcessService(IConfiguration configuration) => this.configuration = configuration;

    public async Task<byte[]> ExportPdfAsync(CrystalExportProcessRequest request)
    {
        if (!File.Exists(request.RptPath)) throw new FileNotFoundException("Report file was not found.", request.RptPath);
        var exePath = configuration["CrystalService:ExePath"];
        if (string.IsNullOrWhiteSpace(exePath) || !File.Exists(exePath))
            throw new InvalidOperationException("Crystal Service executable is not configured or cannot be found.");

        var workDirectory = Path.Combine(Path.GetTempPath(), "CrystalReportPortal", "Executions", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(workDirectory);
        var requestPath = Path.Combine(workDirectory, "request.json");
        var outputPath = Path.Combine(workDirectory, "report.pdf");
        request.OutputPath = outputPath;

        try
        {
            await File.WriteAllTextAsync(requestPath, JsonSerializer.Serialize(request), Encoding.UTF8);
            var startInfo = new ProcessStartInfo
            {
                FileName = exePath,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
                CreateNoWindow = true,
            };
            startInfo.ArgumentList.Add("export");
            startInfo.ArgumentList.Add(requestPath);

            using var process = Process.Start(startInfo)
                ?? throw new InvalidOperationException("Crystal Service could not be started.");
            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            var output = await outputTask;
            var error = await errorTask;

            if (process.ExitCode != 0 || !File.Exists(outputPath))
                throw new InvalidOperationException($"Crystal Service export failed. {output} {error}");

            var pdf = await File.ReadAllBytesAsync(outputPath);
            if (pdf.Length == 0) throw new InvalidOperationException("Crystal Service returned an empty PDF.");
            return pdf;
        }
        finally
        {
            if (Directory.Exists(workDirectory)) Directory.Delete(workDirectory, true);
        }
    }
}
