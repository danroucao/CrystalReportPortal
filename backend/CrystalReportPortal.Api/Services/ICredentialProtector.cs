namespace CrystalReportPortal.Api.Services;

public interface ICredentialProtector
{
    string Protect(string plainText);

    string Unprotect(string protectedText);
}