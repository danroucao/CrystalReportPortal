using CrystalReportPortal.Api.Dtos;

namespace CrystalReportPortal.Api.Services;

public interface IBackOfficeAuthService
{
    Task<BackOfficeLoginResponse> LoginAsync(
        BackOfficeLoginRequest request);

    Task<BackOfficeOperatorResponse> VerifyOperatorAsync(
        BackOfficeOperatorLoginRequest request);

    Task LogLogoutAsync(long operatorUserId);
}