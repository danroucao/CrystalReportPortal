using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace CrystalReportPortal.Api.Services;

public class BackOfficeAuthService : IBackOfficeAuthService
{
    private static readonly TimeSpan ChallengeLifetime =
        TimeSpan.FromMinutes(5);

    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _memoryCache;

    public BackOfficeAuthService(
        AppDbContext dbContext,
        IConfiguration configuration,
        IMemoryCache memoryCache)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _memoryCache = memoryCache;
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

        var challengeId = Guid.NewGuid();

        var expiresAt =
            DateTime.UtcNow.Add(ChallengeLifetime);

        _memoryCache.Set(
            $"BackOfficeChallenge:{challengeId}",
            true,
            ChallengeLifetime);

        return Task.FromResult(
            new BackOfficeLoginResponse
            {
                Success = true,
                Message = "後台帳密驗證成功，請確認操作者身分",
                ChallengeId = challengeId,
                ExpiresAt = expiresAt
            });
    }

    // 第二關：驗證實際操作者的前台帳密
    public async Task<BackOfficeOperatorResponse> VerifyOperatorAsync(
        BackOfficeOperatorRequest request)
    {
        var challengeKey =
            $"BackOfficeChallenge:{request.ChallengeId}";

        var challengeValid =
            _memoryCache.TryGetValue(
                challengeKey,
                out bool challengeExists)
            && challengeExists;

        if (!challengeValid)
        {
            return new BackOfficeOperatorResponse
            {
                Success = false,
                Message = "後台驗證已失效，請重新輸入共用後台帳密"
            };
        }

        // ChallengeId 使用一次後立即失效，避免被重複使用
        _memoryCache.Remove(challengeKey);

        var user = await _dbContext.Users
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Account == request.Account);

        if (user == null || !user.IsEnabled)
        {
            return OperatorFailed();
        }

        var passwordCorrect =
            VerifyPassword(
                request.Password,
                user.PasswordHash);

        if (!passwordCorrect)
        {
            return OperatorFailed();
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

        var expiresAt =
            DateTime.UtcNow.AddMinutes(30);

        var claims = new List<Claim>
        {
            new(
                ClaimTypes.NameIdentifier,
                user.UserId.ToString()),

            new(
                ClaimTypes.Name,
                user.UserName),

            new(
                "Account",
                user.Account),

            new(
                "EmployeeNo",
                user.EmployeeNo),

            new(
                "TokenVersion",
                user.TokenVersion.ToString()),

            new(
                "TokenType",
                "BackOffice")
        };

        var securityKey =
            new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey));

        var credentials =
            new SigningCredentials(
                securityKey,
                SecurityAlgorithms.HmacSha256);

        var jwtToken =
            new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: expiresAt,
                signingCredentials: credentials);

        var tokenText =
            new JwtSecurityTokenHandler()
                .WriteToken(jwtToken);

        return new BackOfficeOperatorResponse
        {
            Success = true,
            Message = "操作者身分確認成功",
            Token = tokenText,
            ExpiresAt = expiresAt,

            Operator = new BackOfficeOperatorDto
            {
                UserId = user.UserId,
                EmployeeNo = user.EmployeeNo,
                Account = user.Account,
                UserName = user.UserName
            }
        };
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
}
