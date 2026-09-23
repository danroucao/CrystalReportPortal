using Microsoft.AspNetCore.DataProtection;
using System.Security.Cryptography;

namespace CrystalReportPortal.Api.Services;

public class CredentialProtector : ICredentialProtector
{
    private const string CurrentPurpose =
        "CrystalReportPortal.DataSourceCredentials.v1";

    private const string LegacyPurpose =
        "CrystalReportPortal.DataSourceCredentials";

    private readonly IDataProtector _protector;
    private readonly IReadOnlyList<IDataProtector> _fallbackProtectors;
    private readonly ILogger<CredentialProtector> _logger;

    public CredentialProtector(
        IDataProtectionProvider provider,
        IConfiguration configuration,
        IWebHostEnvironment environment,
        ILogger<CredentialProtector> logger)
    {
        _logger = logger;
        _protector = provider.CreateProtector(CurrentPurpose);

        var fallbacks = new List<IDataProtector>
        {
            provider.CreateProtector(LegacyPurpose)
        };

        var configuredLegacyPath =
            configuration["DataProtection:LegacyKeyRingPath"];

        var candidatePaths = new[]
        {
            configuredLegacyPath,
            Path.Combine(
                environment.ContentRootPath,
                "keys"),
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "ASP.NET",
                "DataProtection-Keys")
        }
        .Where(path => !string.IsNullOrWhiteSpace(path))
        .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var candidatePath in candidatePaths)
        {
            if (!Directory.Exists(candidatePath!))
            {
                continue;
            }

            try
            {
                var providerFromDirectory =
                    DataProtectionProvider.Create(
                        new DirectoryInfo(candidatePath!));

                fallbacks.Add(
                    providerFromDirectory.CreateProtector(CurrentPurpose));

                fallbacks.Add(
                    providerFromDirectory.CreateProtector(LegacyPurpose));
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "無法建立 legacy DataProtection Provider：{KeyPath}",
                    candidatePath);
            }
        }

        _fallbackProtectors = fallbacks;
    }

    public string Protect(string plainText)
    {
        if (string.IsNullOrEmpty(plainText))
        {
            throw new ArgumentException(
                "密碼不可為空。",
                nameof(plainText));
        }

        return _protector.Protect(plainText);
    }

    public string Unprotect(string protectedText)
    {
        if (string.IsNullOrEmpty(protectedText))
        {
            throw new ArgumentException(
                "加密密碼不可為空。",
                nameof(protectedText));
        }

        try
        {
            return _protector.Unprotect(protectedText);
        }
        catch (CryptographicException)
        {
            foreach (var fallbackProtector in _fallbackProtectors)
            {
                try
                {
                    var plainText =
                        fallbackProtector.Unprotect(protectedText);

                    _logger.LogWarning(
                        "資料庫憑證使用 legacy 金鑰或 purpose 解密成功，建議重新儲存以完成金鑰輪替。");

                    return plainText;
                }
                catch (CryptographicException)
                {
                    // 嘗試下一組 legacy protector。
                }
            }

            throw;
        }
    }
}