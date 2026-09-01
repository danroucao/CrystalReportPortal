using ReportSystem.Api.Dtos;

namespace ReportSystem.Api.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);

    Task<LoginResponse> ChangePasswordAsync(ChangePasswordRequest request);

    Task LogoutAsync(long userId);
}
