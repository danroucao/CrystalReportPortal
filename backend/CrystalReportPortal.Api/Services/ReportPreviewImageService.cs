using System.Collections.Concurrent;
using System.Diagnostics;

namespace CrystalReportPortal.Api.Services;

public sealed record ReportPreviewDocument(Guid PreviewId, int PageCount);

public interface IReportPreviewImageService
{
    Task<ReportPreviewDocument> CreateAsync(byte[] pdf, long ownerUserId);
    bool TryGetPage(Guid previewId, long ownerUserId, int pageNumber, out string pagePath);
}

/// <summary>
/// Keeps short-lived, rasterized report previews outside the browser PDF viewer.
/// PDF bytes never leave this service for preview-only users.
/// </summary>
public sealed class ReportPreviewImageService(IConfiguration configuration)
    : IReportPreviewImageService
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);
    private readonly ConcurrentDictionary<Guid, StoredPreview> previews = new();

    public async Task<ReportPreviewDocument> CreateAsync(byte[] pdf, long ownerUserId)
    {
        if (pdf.Length == 0) throw new InvalidOperationException("Report preview PDF is empty.");

        RemoveExpired();
        var previewId = Guid.NewGuid();
        var directory = Path.Combine(Path.GetTempPath(), "CrystalReportPortal", "PreviewImages", previewId.ToString("N"));
        Directory.CreateDirectory(directory);
        var pdfPath = Path.Combine(directory, "report.pdf");
        var outputPrefix = Path.Combine(directory, "page");

        try
        {
            await File.WriteAllBytesAsync(pdfPath, pdf);
            var rendererPath = ResolveRendererPath();
            var startInfo = new ProcessStartInfo
            {
                FileName = rendererPath,
                UseShellExecute = false,
                RedirectStandardError = true,
                RedirectStandardOutput = true,
                CreateNoWindow = true
            };
            startInfo.ArgumentList.Add("-png");
            startInfo.ArgumentList.Add("-r");
            startInfo.ArgumentList.Add("144");
            startInfo.ArgumentList.Add(pdfPath);
            startInfo.ArgumentList.Add(outputPrefix);

            Process? process;
            try
            {
                process = Process.Start(startInfo);
            }
            catch (System.ComponentModel.Win32Exception exception)
            {
                throw new InvalidOperationException(
                    "PDF 預覽轉譯器 pdftoppm 無法啟動。請安裝 Poppler，並確認 pdftoppm 已加入 PATH；"
                    + "或設定 PdfPreview:RendererPath 為 pdftoppm.exe 的完整路徑。",
                    exception);
            }

            using (process ?? throw new InvalidOperationException("Could not start the PDF preview renderer."))
            {
            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();

            var pages = Directory.GetFiles(directory, "page-*.png")
                .OrderBy(GetPageNumber)
                .ToArray();
            if (process.ExitCode != 0 || pages.Length == 0)
            {
                var details = (await errorTask).Trim();
                _ = await outputTask;
                throw new InvalidOperationException(
                    $"PDF preview rendering failed. {details}".Trim());
            }

            previews[previewId] = new StoredPreview(ownerUserId, DateTime.UtcNow.Add(Lifetime), directory, pages);
            return new ReportPreviewDocument(previewId, pages.Length);
            }
        }
        catch
        {
            DeleteDirectory(directory);
            throw;
        }
    }

    public bool TryGetPage(Guid previewId, long ownerUserId, int pageNumber, out string pagePath)
    {
        RemoveExpired();
        pagePath = string.Empty;
        if (!previews.TryGetValue(previewId, out var preview) || preview.OwnerUserId != ownerUserId) return false;
        if (pageNumber < 1 || pageNumber > preview.PagePaths.Length) return false;
        pagePath = preview.PagePaths[pageNumber - 1];
        return File.Exists(pagePath);
    }

    private void RemoveExpired()
    {
        var now = DateTime.UtcNow;
        foreach (var item in previews.Where(item => item.Value.ExpiresAt <= now))
        {
            if (previews.TryRemove(item.Key, out var preview)) DeleteDirectory(preview.Directory);
        }
    }

    private static void DeleteDirectory(string directory)
    {
        try { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
        catch { /* Preview cleanup must not affect report execution. */ }
    }

    private static int GetPageNumber(string path)
    {
        var fileName = Path.GetFileNameWithoutExtension(path);
        return int.TryParse(fileName["page-".Length..], out var pageNumber) ? pageNumber : int.MaxValue;
    }

    private string ResolveRendererPath()
    {
        var configuredPath = configuration["PdfPreview:RendererPath"];
        if (!string.IsNullOrWhiteSpace(configuredPath) &&
            !string.Equals(configuredPath, "pdftoppm", StringComparison.OrdinalIgnoreCase))
        {
            return configuredPath;
        }

        // WinGet updates the user PATH, but processes started before the installation can retain
        // the old environment. In that case use its known installation directory as a local fallback.
        var wingetPackages = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Microsoft", "WinGet", "Packages");
        if (Directory.Exists(wingetPackages))
        {
            try
            {
                var installedRenderer = Directory
                    .GetFiles(wingetPackages, "pdftoppm.exe", SearchOption.AllDirectories)
                    .OrderByDescending(File.GetLastWriteTimeUtc)
                    .FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(installedRenderer)) return installedRenderer;
            }
            catch (UnauthorizedAccessException)
            {
                // Fall back to the configured command for locked-down service accounts.
            }
        }

        return string.IsNullOrWhiteSpace(configuredPath) ? "pdftoppm" : configuredPath;
    }

    private sealed record StoredPreview(long OwnerUserId, DateTime ExpiresAt, string Directory, string[] PagePaths);
}
