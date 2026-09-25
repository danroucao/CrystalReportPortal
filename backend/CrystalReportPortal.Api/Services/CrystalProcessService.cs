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

    public async Task<IReadOnlyList<string>> GetHeaderTextsAsync(string rptPath)
    {
        if (!File.Exists(rptPath)) throw new FileNotFoundException("RPT file was not found.", rptPath);
        var exePath = _configuration["CrystalService:ExePath"];
        if (string.IsNullOrWhiteSpace(exePath) || !File.Exists(exePath))
            throw new InvalidOperationException("Crystal Service executable is not available.");

        var startInfo = new ProcessStartInfo
        {
            FileName = exePath, UseShellExecute = false, RedirectStandardOutput = true,
            RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8, CreateNoWindow = true
        };
        startInfo.ArgumentList.Add("header-texts");
        startInfo.ArgumentList.Add(rptPath);
        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Could not start Crystal Service.");
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        var output = await outputTask;
        var error = await errorTask;
        if (process.ExitCode != 0 || string.IsNullOrWhiteSpace(output))
            throw new InvalidOperationException($"Crystal Service header detection failed. {error}");

        using var json = JsonDocument.Parse(output);
        if (!json.RootElement.TryGetProperty("HeaderTexts", out var headerTexts)) return [];
        return headerTexts.EnumerateArray()
            .Select(item => item.GetString())
            .Where(text => !string.IsNullOrWhiteSpace(text))
            .Select(text => text!.Trim())
            .ToList();
    }

    public async Task CreateLocalizedTemplateAsync(
        string sourceRptPath,
        string outputRptPath,
        IReadOnlyDictionary<string, string> replacements)
    {
        var exePath = _configuration["CrystalService:ExePath"];
        if (!File.Exists(sourceRptPath) || string.IsNullOrWhiteSpace(exePath) || !File.Exists(exePath))
            throw new InvalidOperationException("Crystal Service or the source RPT is not available.");

        var requestPath = Path.Combine(Path.GetTempPath(), $"crystal-localize-{Guid.NewGuid():N}.json");
        try
        {
            await File.WriteAllTextAsync(requestPath, JsonSerializer.Serialize(new
            {
                RptPath = sourceRptPath,
                OutputPath = outputRptPath,
                HeaderTextReplacements = replacements
            }), new UTF8Encoding(false));
            var startInfo = new ProcessStartInfo
            {
                FileName = exePath, UseShellExecute = false, RedirectStandardOutput = true,
                RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8, CreateNoWindow = true
            };
            startInfo.ArgumentList.Add("localize-template");
            startInfo.ArgumentList.Add(requestPath);
            using var process = Process.Start(startInfo)
                ?? throw new InvalidOperationException("Could not start Crystal Service.");
            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            var output = await outputTask;
            var error = await errorTask;
            using var response = JsonDocument.Parse(output);
            var success = response.RootElement.TryGetProperty("Success", out var successElement) &&
                successElement.GetBoolean();
            if (process.ExitCode != 0 || !success)
                throw new InvalidOperationException($"Could not generate localized RPT. {error} {output}");
        }
        finally
        {
            if (File.Exists(requestPath)) File.Delete(requestPath);
        }
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
        var requestPath = Path.Combine(
            tempDirectory,
            $"{Guid.NewGuid():N}.json");

        try
        {
            var request = new
            {
                RptPath = rptPath,
                OutputPath = outputPath,
                UseSavedDataOnly = true
            };
            await File.WriteAllTextAsync(
                requestPath,
                JsonSerializer.Serialize(request),
                Encoding.UTF8);

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

            startInfo.ArgumentList.Add(requestPath);

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

            if (File.Exists(requestPath))
            {
                try
                {
                    File.Delete(requestPath);
                }
                catch
                {
                }
            }
        }
    }

    public async Task<CrystalDatabaseTestResponse>
    TestDatabaseConnectionAsync(
        CrystalDatabaseTestRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(request.Server))
        {
            throw new ArgumentException(
                "資料庫伺服器不可空白。",
                nameof(request));
        }

        if (string.IsNullOrWhiteSpace(request.Database))
        {
            throw new ArgumentException(
                "資料庫名稱不可空白。",
                nameof(request));
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

        var tempDirectory =
            Path.Combine(
                Path.GetTempPath(),
                "CrystalReportPortal",
                "DatabaseTests");

        Directory.CreateDirectory(tempDirectory);

        var requestPath =
            Path.Combine(
                tempDirectory,
                $"{Guid.NewGuid():N}.json");

        try
        {
            var json =
                JsonSerializer.Serialize(
                    request,
                    new JsonSerializerOptions
                    {
                        WriteIndented = false
                    });

            await File.WriteAllTextAsync(
                requestPath,
                json,
                new UTF8Encoding(
                    encoderShouldEmitUTF8Identifier: false));

            var startInfo =
                new ProcessStartInfo
                {
                    FileName = exePath,

                    UseShellExecute = false,

                    RedirectStandardOutput = true,

                    RedirectStandardError = true,

                    StandardOutputEncoding = Encoding.UTF8,

                    StandardErrorEncoding = Encoding.UTF8,

                    CreateNoWindow = true
                };

            startInfo.ArgumentList.Add("test-connection");
            startInfo.ArgumentList.Add(requestPath);

            using var process =
                new Process
                {
                    StartInfo = startInfo
                };

            if (!process.Start())
            {
                throw new InvalidOperationException(
                    "無法啟動 Crystal Service。");
            }

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
                    "Crystal Service 沒有回傳連線測試結果。"
                    + Environment.NewLine
                    + error);
            }

            CrystalDatabaseTestResponse? response;

            try
            {
                response =
                    JsonSerializer.Deserialize<
                        CrystalDatabaseTestResponse>(
                        output.Trim(),
                        new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException(
                    "Crystal Service 回傳的連線測試結果"
                    + "不是有效的 JSON。"
                    + Environment.NewLine
                    + output,
                    ex);
            }

            if (response == null)
            {
                throw new InvalidOperationException(
                    "無法解析 Crystal Service 的"
                    + "連線測試結果。");
            }

            /*
             * 連線失敗也可能由 Crystal Service 以 JSON 正常回傳，
             * 所以優先回傳 response，讓 Controller 決定 HTTP 狀態。
             */
            if (process.ExitCode != 0 &&
                response.Success)
            {
                throw new InvalidOperationException(
                    $"Crystal Service 執行失敗，"
                    + $"ExitCode={process.ExitCode}。"
                    + Environment.NewLine
                    + error);
            }

            return response;
        }
        finally
        {
            if (File.Exists(requestPath))
            {
                try
                {
                    File.Delete(requestPath);
                }
                catch
                {
                    // 暫存檔刪除失敗不覆蓋原本測試結果。
                }
            }
        }
    }

    public async Task<CrystalLovResponse> GetLovOptionsAsync(
        CrystalLovRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var exePath = _configuration["CrystalService:ExePath"];
        if (string.IsNullOrWhiteSpace(exePath))
        {
            throw new InvalidOperationException(
                "尚未設定 CrystalService:ExePath。");
        }

        if (!File.Exists(exePath))
        {
            throw new FileNotFoundException(
                "找不到 Crystal Service 執行檔。", exePath);
        }

        var tempDirectory = Path.Combine(
            Path.GetTempPath(),
            "CrystalReportPortal",
            "LovQueries");
        Directory.CreateDirectory(tempDirectory);

        var requestPath = Path.Combine(
            tempDirectory,
            $"{Guid.NewGuid():N}.json");

        try
        {
            await File.WriteAllTextAsync(
                requestPath,
                JsonSerializer.Serialize(request),
                new UTF8Encoding(false));

            var startInfo = new ProcessStartInfo
            {
                FileName = exePath,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
                CreateNoWindow = true
            };
            startInfo.ArgumentList.Add("lov-options");
            startInfo.ArgumentList.Add(requestPath);

            using var process = Process.Start(startInfo)
                ?? throw new InvalidOperationException(
                    "無法啟動 Crystal Service。");

            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();

            var output = await outputTask;
            var error = await errorTask;

            if (string.IsNullOrWhiteSpace(output))
            {
                throw new InvalidOperationException(
                    "Crystal Service 沒有回傳 SQL LOV 結果。"
                    + Environment.NewLine + error);
            }

            var response = JsonSerializer.Deserialize<CrystalLovResponse>(
                output.Trim(),
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

            if (response == null)
            {
                throw new InvalidOperationException(
                    "無法解析 Crystal Service 的 SQL LOV 結果。");
            }

            if (!response.Success)
            {
                throw new InvalidOperationException(
                    response.Message ?? "SQL LOV 查詢失敗。");
            }

            return response;
        }
        finally
        {
            if (File.Exists(requestPath))
            {
                try
                {
                    File.Delete(requestPath);
                }
                catch
                {
                    // 暫存檔刪除失敗不覆蓋原本查詢結果。
                }
            }
        }
    }
}
