using Microsoft.AspNetCore.DataProtection;

namespace CrystalReportPortal.Api.Services;

public class CredentialProtector : ICredentialProtector
{
    private readonly IDataProtector _protector;

    public CredentialProtector(
        IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector(
            "CrystalReportPortal.DataSourceCredentials.v1");
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

        return _protector.Unprotect(protectedText);
    }
}