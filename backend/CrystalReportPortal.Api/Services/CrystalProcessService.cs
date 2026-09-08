using System.Diagnostics;
using System.Text.Json;
using CrystalReportPortal.Api.Dtos;
using System.Text;

namespace CrystalReportPortal.Api.Services;

public class CrystalProcessService : ICrystalProcessService
{
    private readonly IConfiguration _configuration;

    public CrystalProcessService(
        IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task<CrystalParameterParseResponse>
        GetParametersAsync(string rptPath)
    {
        if (!File.Exists(rptPath))
        {
            throw new FileNotFoundException(
                "找不到 RPT 檔案。",
                rptPath);
        }

        var exePath =
            _configuration["CrystalService:ExePath"];

        if (string.IsNullOrWhiteSpace(exePath))
        {
            throw new InvalidOperationException(
                "尚未設定 CrystalService:ExePath。");
        }

        if (!File.Exists(exePath))
        {
            throw new FileNotFoundException(
                "找不到 Crystal Service 執行檔。",
                exePath);
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = exePath,

            UseShellExecute = false,

            RedirectStandardOutput = true,

            RedirectStandardError = true,

            CreateNoWindow = true
        };

        startInfo.ArgumentList.Add("parameters");
        startInfo.ArgumentList.Add(rptPath);

        using var process = new Process
        {
            StartInfo = startInfo
        };

        process.Start();

        var outputTask =
            process.StandardOutput.ReadToEndAsync();

        var errorTask =
            process.StandardError.ReadToEndAsync();

        await process.WaitForExitAsync();

        var output = await outputTask;
        var error = await errorTask;

        if (string.IsNullOrWhiteSpace(output))
        {
            throw new InvalidOperationException(
                $"Crystal Service 沒有回傳資料。{error}");
        }

        CrystalParameterParseResponse? response;

        try
        {
            response =
                JsonSerializer.Deserialize<
                    CrystalParameterParseResponse>(
                    output,
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException(
                "Crystal Service 回傳的內容不是有效 JSON。\n"
                + output,
                ex);
        }

        if (response == null)
        {
            throw new InvalidOperationException(
                "無法解析 Crystal Service 回傳結果。");
        }

        if (!response.Success)
        {
            throw new InvalidOperationException(
                response.Message
                ?? "Crystal Service 解析失敗。");
        }

        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException(
                $"Crystal Service 執行失敗，"
                + $"ExitCode={process.ExitCode}。"
                + error);
        }

        return response;
    }

    public async Task<byte[]> PreviewAsync(
    string rptPath)
    {
        // ============================
        // 1. 檢查 RPT
        // ============================

        if (!File.Exists(rptPath))
        {
            throw new FileNotFoundException(
                "找不到 RPT 檔案。",
                rptPath);
        }

        // ============================
        // 2. 取得 Crystal Service EXE
        // ============================

        var exePath =
            _configuration["CrystalService:ExePath"];

        if (string.IsNullOrWhiteSpace(exePath))
        {
            throw new InvalidOperationException(
                "尚未設定 CrystalService:ExePath。");
        }

        if (!File.Exists(exePath))
        {
            throw new FileNotFoundException(
                "找不到 Crystal Service 執行檔。",
                exePath);
        }

        // ============================
        // 3. 建立暫存 PDF
        // ============================

        var tempDirectory =
            Path.Combine(
                Path.GetTempPath(),
                "CrystalReportPortal",
                "Preview");

        Directory.CreateDirectory(
            tempDirectory);

        var outputPath =
            Path.Combine(
                tempDirectory,
                $"{Guid.NewGuid():N}.pdf");

        try
        {
            // ============================
            // 4. 執行 Crystal Service
            // ============================

            var startInfo =
                new ProcessStartInfo
                {
                    FileName = exePath,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    StandardOutputEncoding =
                        Encoding.UTF8,
                    StandardErrorEncoding =
                        Encoding.UTF8,
                    CreateNoWindow = true
                };

            startInfo.ArgumentList.Add(
                "preview");

            startInfo.ArgumentList.Add(
                rptPath);

            startInfo.ArgumentList.Add(
                outputPath);

            using var process =
                new Process
                {
                    StartInfo = startInfo
                };

            process.Start();

            var outputTask =
                process.StandardOutput
                    .ReadToEndAsync();

            var errorTask =
                process.StandardError
                    .ReadToEndAsync();

            await process.WaitForExitAsync();

            var output =
                await outputTask;

            var error =
                await errorTask;

            // ============================
            // 5. 檢查執行結果
            // ============================

            if (process.ExitCode != 0)
            {
                throw new InvalidOperationException(
                    "Crystal Service 預覽失敗。"
                    + Environment.NewLine
                    + output
                    + Environment.NewLine
                    + error);
            }

            if (!File.Exists(outputPath))
            {
                throw new InvalidOperationException(
                    "Crystal Service 執行成功，"
                    + "但沒有產生 PDF 檔案。"
                    + Environment.NewLine
                    + output);
            }

            // ============================
            // 6. 讀取 PDF
            // ============================

            var pdfBytes =
                await File.ReadAllBytesAsync(
                    outputPath);

            if (pdfBytes.Length == 0)
            {
                throw new InvalidOperationException(
                    "Crystal Service 產生的 PDF 為空白檔案。");
            }

            return pdfBytes;
        }
        finally
        {
            // ============================
            // 7. 刪除暫存 PDF
            // ============================

            if (File.Exists(outputPath))
            {
                try
                {
                    File.Delete(outputPath);
                }
                catch
                {
                    // 暫存檔刪除失敗不影響預覽結果
                }
            }
        }
    }
}