using CrystalReportPortal.Api.Dtos;

namespace CrystalReportPortal.Api.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);

    Task<LoginResponse> ChangePasswordAsync(ChangePasswordRequest request, long userId);

    Task<bool> UpdateProfileAsync(long userId, UpdateProfileRequest request);

    Task LogoutAsync(long userId);
}