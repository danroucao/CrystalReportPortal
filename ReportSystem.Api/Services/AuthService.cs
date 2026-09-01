using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ReportSystem.Api.Data;
using ReportSystem.Api.Dtos;
using ReportSystem.Api.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace ReportSystem.Api.Services;

public class AuthService : IAuthService
{
    private const string LoginAction = "LOGIN";
    private const string LogoutAction = "LOGOUT";
    private const int MaximumFailedLogins = 5;
    private static readonly TimeSpan LockWindow = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan PasswordLifetime = TimeSpan.FromDays(90);
    private readonly ReportSystemDbContext _dbContext;
    private readonly IConfiguration _configuration;

    public AuthService(
        ReportSystemDbContext dbContext,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _configuration = configuration;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        var user = await _dbContext.Users
            .Include(u => u.UserRoles)
            .ThenInclude(userRole => userRole.Role)
            .SingleOrDefaultAsync(u => u.EmployeeNo == request.EmployeeNo);

        if (user == null)
        {
            await WriteAuditLogAsync(null, "FAILED", request.EmployeeNo, "帳號不存在");
            return LoginFailed("帳號或密碼錯誤");
        }

        if (!user.IsEnabled)
        {
            await WriteAuditLogAsync(user.UserId, "DENIED", null, "帳號已停用");
            return LoginFailed("此帳號已被停用");
        }

        if (await IsTemporarilyLockedAsync(user.UserId))
        {
            await WriteAuditLogAsync(user.UserId, "DENIED", null, "登入失敗次數過多，帳號暫時鎖定");
            return LoginFailed("登入失敗次數過多，請 15 分鐘後再試");
        }

        var passwordCorrect = VerifyPassword(request.Password, user.PasswordHash);

        if (!passwordCorrect)
        {
            await WriteAuditLogAsync(user.UserId, "FAILED", null, "密碼錯誤");
            return LoginFailed("帳號或密碼錯誤");
        }

        var passwordReferenceTime = user.PasswordChangedAt ?? user.CreatedAt;
        if (passwordReferenceTime.ToUniversalTime().Add(PasswordLifetime) <= DateTime.UtcNow)
        {
            await WriteAuditLogAsync(user.UserId, "DENIED", null, "密碼已超過 90 天未更新");
            return new LoginResponse
            {
                Success = false,
                PasswordExpired = true,
                Message = "密碼已過期，請先修改密碼"
            };
        }

        var roles = user.UserRoles
            .Where(userRole => userRole.Role.IsEnabled)
            .Select(userRole => userRole.Role.RoleCode)
            .Distinct()
            .ToList();

        var jwtKey = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("找不到 Jwt:Key");

        var jwtIssuer = _configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException("找不到 Jwt:Issuer");

        var jwtAudience = _configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException("找不到 Jwt:Audience");

        int expireMinutes =
            _configuration.GetValue<int>("Jwt:ExpireMinutes");

        var claims = new List<Claim>
{
    new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
    new(ClaimTypes.Name, user.UserName),
    new("EmployeeNo", user.EmployeeNo),
    new("TokenVersion", user.TokenVersion.ToString())
};

        claims.AddRange(
            roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var securityKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtKey));

        var credentials = new SigningCredentials(
            securityKey,
            SecurityAlgorithms.HmacSha256);

        var expiresAt = DateTime.UtcNow.AddMinutes(expireMinutes);

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        string tokenText =
            new JwtSecurityTokenHandler().WriteToken(token);

        await WriteAuditLogAsync(user.UserId, "SUCCESS", null, null);

        return new LoginResponse
        {
            Success = true,
            Message = "登入成功",
            Token = tokenText,
            ExpiresAt = expiresAt,
            User = new LoginUserDto
            {
                UserId = user.UserId,
                EmployeeNo = user.EmployeeNo,
                UserName = user.UserName,
                Roles = roles
            }
        };
    }

    public async Task LogoutAsync(long userId)
    {
        var user = await _dbContext.Users.SingleOrDefaultAsync(
            candidate => candidate.UserId == userId);

        if (user == null)
        {
            return;
        }

        user.TokenVersion += 1;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = user.UserId,
            Action = LogoutAction,
            Result = "SUCCESS",
            Details = "使用者登出，舊 Token 已失效",
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
    }

    private static LoginResponse LoginFailed(string message)
    {
        return new LoginResponse
        {
            Success = false,
            Message = message
        };
    }

    public async Task<LoginResponse> ChangePasswordAsync(ChangePasswordRequest request)
    {
        if (!IsPasswordComplexEnough(request.NewPassword))
        {
            return LoginFailed("新密碼至少 8 碼，且必須同時包含英文與數字");
        }

        var user = await _dbContext.Users.SingleOrDefaultAsync(
            candidate => candidate.EmployeeNo == request.EmployeeNo);

        if (user == null || !user.IsEnabled ||
            !VerifyPassword(request.CurrentPassword, user.PasswordHash))
        {
            if (user != null)
            {
                await WriteAuditLogAsync(user.UserId, "FAILED", null, "修改密碼驗證失敗");
            }

            return LoginFailed("帳號、目前密碼錯誤，或帳號已停用");
        }

        var now = DateTime.UtcNow;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.PasswordChangedAt = now;
        user.TokenVersion += 1;
        user.UpdatedAt = now;

        await WriteAuditLogAsync(user.UserId, "SUCCESS", null, "密碼已更新");
        await _dbContext.SaveChangesAsync();

        return new LoginResponse
        {
            Success = true,
            Message = "密碼修改成功，請使用新密碼重新登入"
        };
    }

    private async Task<bool> IsTemporarilyLockedAsync(long userId)
    {
        var cutoff = DateTime.UtcNow.Subtract(LockWindow);
        var failures = await _dbContext.AuditLogs
            .Where(log => log.UserId == userId &&
                          log.Action == LoginAction &&
                          log.Result == "FAILED" &&
                          log.CreatedAt >= cutoff)
            .CountAsync();

        return failures >= MaximumFailedLogins;
    }

    private async Task WriteAuditLogAsync(
        long? userId,
        string result,
        string? details,
        string? errorMessage)
    {
        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = LoginAction,
            Result = result,
            Details = details,
            ErrorMessage = errorMessage,
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
    }

    private static bool IsPasswordComplexEnough(string password)
    {
        return password.Length >= 8 &&
               password.Any(char.IsLetter) &&
               password.Any(char.IsDigit);
    }

    private static bool VerifyPassword(string password, string passwordHash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, passwordHash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            return false;
        }
    }
}
