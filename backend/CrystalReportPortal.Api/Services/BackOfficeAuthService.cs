using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace CrystalReportPortal.Api.Services;

public class BackOfficeAuthService
    : IBackOfficeAuthService
{
    private const string SharedLoginAction =
        "BACKOFFICE_SHARED_LOGIN";

    private const string OperatorVerifyAction =
        "BACKOFFICE_OPERATOR_VERIFY";

    private const string LogoutAction =
        "BACKOFFICE_LOGOUT";

    private const int MaximumFailedLogins = 5;

    private static readonly TimeSpan LockWindow =
        TimeSpan.FromMinutes(15);

    private static readonly TimeSpan PasswordLifetime =
        TimeSpan.FromDays(90);

    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;

    public BackOfficeAuthService(
        AppDbContext dbContext,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _configuration = configuration;
    }

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

        var accountCorrect =
            string.Equals(
                request.Account,
                configuredAccount,
                StringComparison.Ordinal);

        var passwordCorrect =
            string.Equals(
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

        var jwtKey =
            _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException(
                "找不到 Jwt:Key");

        var jwtIssuer =
            _configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException(
                "找不到 Jwt:Issuer");

        var jwtAudience =
            _configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException(
                "找不到 Jwt:Audience");

        var expireMinutes =
            _configuration.GetValue<int?>(
                "BackOffice:JwtExpireMinutes")
            ?? 15;

        var expiresAt =
            DateTime.UtcNow.AddMinutes(
                expireMinutes);

        var claims =
            new List<Claim>
            {
            new Claim(
                "TokenType",
                "BackOffice"),

            new Claim(
                "BackOfficeStage",
                "SharedAccountVerified"),

            new Claim(
                "BackOfficeAccount",
                configuredAccount)
            };

        var securityKey =
            new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(
                    jwtKey));

        var credentials =
            new SigningCredentials(
                securityKey,
                SecurityAlgorithms.HmacSha256);

        var token =
            new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: expiresAt,
                signingCredentials: credentials);

        var tokenText =
            new JwtSecurityTokenHandler()
                .WriteToken(token);

        return Task.FromResult(
            new BackOfficeLoginResponse
            {
                Success = true,
                Message =
                    "後台帳密驗證成功，請進行第二階段操作者驗證",

                Token = tokenText,
                ExpiresAt = expiresAt
            });
    }

    public async Task<BackOfficeOperatorResponse>
        VerifyOperatorAsync(
            BackOfficeOperatorLoginRequest request)
    {
        var account =
            request.Account?.Trim()
            ?? string.Empty;

        var user =
            await _dbContext.Users
                .SingleOrDefaultAsync(candidate =>
                    candidate.Account == account);

        if (user == null)
        {
            await WriteAuditLogAsync(
                null,
                OperatorVerifyAction,
                "FAILED",
                $"嘗試驗證的操作者帳號：{account}",
                "操作者帳號不存在");

            return OperatorFailed();
        }

        if (!user.IsEnabled)
        {
            await WriteAuditLogAsync(
                user.UserId,
                OperatorVerifyAction,
                "DENIED",
                null,
                "操作者帳號已停用");

            return OperatorFailed();
        }

        if (await IsTemporarilyLockedAsync(
                user.UserId))
        {
            await WriteAuditLogAsync(
                user.UserId,
                OperatorVerifyAction,
                "DENIED",
                null,
                "登入失敗次數過多，帳號暫時鎖定");

            return new BackOfficeOperatorResponse
            {
                Success = false,
                Message =
                    "登入失敗次數過多，請十五分鐘後再試"
            };
        }

        if (!VerifyPassword(
                request.Password,
                user.PasswordHash))
        {
            await WriteAuditLogAsync(
                user.UserId,
                OperatorVerifyAction,
                "FAILED",
                null,
                "操作者密碼錯誤");

            return OperatorFailed();
        }

        var passwordReferenceTime =
            user.PasswordChangedAt
            ?? user.CreatedAt;

        if (passwordReferenceTime
                .ToUniversalTime()
                .Add(PasswordLifetime)
            <= DateTime.UtcNow)
        {
            await WriteAuditLogAsync(
                user.UserId,
                OperatorVerifyAction,
                "DENIED",
                null,
                "操作者密碼已超過九十天未更新");

            return new BackOfficeOperatorResponse
            {
                Success = false,
                PasswordExpired = true,
                Message =
                    "個人密碼已過期，請先至一般登入頁面修改密碼"
            };
        }

        await WriteAuditLogAsync(
            user.UserId,
            OperatorVerifyAction,
            "SUCCESS",
            $"操作者帳號：{user.Account}",
            null);

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

    public async Task LogLogoutAsync(
        long operatorUserId)
    {
        await WriteAuditLogAsync(
            operatorUserId,
            LogoutAction,
            "SUCCESS",
            "後台操作者登出",
            null);
    }

    private async Task<bool>
        IsTemporarilyLockedAsync(long userId)
    {
        var cutoff =
            DateTime.UtcNow.Subtract(
                LockWindow);

        var failureCount =
            await _dbContext.AuditLogs
                .Where(log =>
                    log.UserId == userId &&
                    (log.Action == "LOGIN" ||
                     log.Action ==
                         OperatorVerifyAction) &&
                    log.Result == "FAILED" &&
                    log.CreatedAt >= cutoff)
                .CountAsync();

        return failureCount >= MaximumFailedLogins;
    }

    private async Task WriteAuditLogAsync(
        long? userId,
        string action,
        string result,
        string? details,
        string? errorMessage)
    {
        _dbContext.AuditLogs.Add(
            new AuditLog
            {
                UserId = userId,
                Action = action,
                Result = result,
                Details = details,
                ErrorMessage = errorMessage,
                CreatedAt = DateTime.UtcNow
            });

        await _dbContext.SaveChangesAsync();
    }

    private static BackOfficeOperatorResponse
        OperatorFailed()
    {
        return new BackOfficeOperatorResponse
        {
            Success = false,
            Message =
                "使用者帳號或密碼錯誤，或帳號已停用"
        };
    }

    private static bool VerifyPassword(
        string? password,
        string passwordHash)
    {
        if (string.IsNullOrEmpty(password) ||
            string.IsNullOrWhiteSpace(passwordHash))
        {
            return false;
        }

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
        catch (ArgumentException)
        {
            return false;
        }
    }
}