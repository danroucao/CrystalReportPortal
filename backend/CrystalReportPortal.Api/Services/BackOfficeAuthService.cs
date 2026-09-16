using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Services;

public class BackOfficeAuthService : IBackOfficeAuthService
{
    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;

    public BackOfficeAuthService(
        AppDbContext dbContext,
        IConfiguration configuration
        )
    {
        _dbContext = dbContext;
        _configuration = configuration;
    }

    // 第一關：驗證共用後台帳密
    public Task<BackOfficeLoginResponse> LoginAsync(
        BackOfficeLoginRequest request)
    {
        var configuredAccount =
            _configuration["BackOffice:Account"]
            ?? throw new InvalidOperationException(
                "找不到 BackOffice:Account");

        var configuredPassword =
            _configuration["BackOffice:Password"]
            ?? throw new InvalidOperationException(
                "找不到 BackOffice:Password");

        var accountCorrect = string.Equals(
            request.Account,
            configuredAccount,
            StringComparison.Ordinal);

        var passwordCorrect = string.Equals(
            request.Password,
            configuredPassword,
            StringComparison.Ordinal);

        if (!accountCorrect || !passwordCorrect)
        {
            return Task.FromResult(
                new BackOfficeLoginResponse
                {
                    Success = false,
                    Message = "後台帳號或密碼錯誤"
                });
        }

        return Task.FromResult(
            new BackOfficeLoginResponse
            {
                Success = true,
                Message = "後台帳密驗證成功，請確認操作者身分",
            });
    }

    private static BackOfficeOperatorResponse OperatorFailed()
    {
        return new BackOfficeOperatorResponse
        {
            Success = false,
            Message = "使用者帳號或密碼錯誤，或帳號已停用"
        };
    }

    private static bool VerifyPassword(
        string password,
        string passwordHash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(
                password,
                passwordHash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            return false;
        }
    }

    public async Task<BackOfficeOperatorResponse> VerifyOperatorAsync(
     BackOfficeOperatorLoginRequest request)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(
                x => x.Account == request.Account);

        if (user == null)
        {
            return OperatorFailed();
        }

        if (!user.IsEnabled)
        {
            return OperatorFailed();
        }

        if (!VerifyPassword(
                request.Password,
                user.PasswordHash))
        {
            return OperatorFailed();
        }

        return new BackOfficeOperatorResponse
        {
            Success = true,
            Message = "操作者驗證成功",

            Operator = new BackOfficeOperatorDto
            {
                UserId = user.UserId,
                Account = user.Account,
                UserName = user.UserName
            }
        };
    }
}
