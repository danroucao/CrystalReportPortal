using System.Diagnostics;
using System.Text.Json;
using CrystalReportPortal.Api.Dtos;

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
}