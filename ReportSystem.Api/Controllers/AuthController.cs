using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ReportSystem.Api.Data;
using ReportSystem.Api.Dtos;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;

namespace ReportSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ReportSystemDbContext _dbContext;
    private readonly IConfiguration _configuration;

    public AuthController(
        ReportSystemDbContext dbContext,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _configuration = configuration;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await _dbContext.Users
            .Include(u => u.UserRoles)
            .ThenInclude(userRole => userRole.Role)
            .SingleOrDefaultAsync(
                u => u.EmployeeNo == request.EmployeeNo
            );

        if (user == null)
        {
            return Unauthorized(new
            {
                success = false,
                message = "帳號或密碼錯誤"
            });
        }

        if (!user.IsEnabled)
        {
            return Unauthorized(new
            {
                success = false,
                message = "此帳號已被停用"
            });
        }

        bool passwordCorrect;

        try
        {
            passwordCorrect = BCrypt.Net.BCrypt.Verify(
                request.Password,
                user.PasswordHash
            );
        }
        catch (BCrypt.Net.SaltParseException)
        {
            passwordCorrect = false;
        }

        if (!passwordCorrect)
        {
            return Unauthorized(new
            {
                success = false,
                message = "帳號或密碼錯誤"
            });

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
            new Claim(
                ClaimTypes.NameIdentifier,
                user.UserId.ToString()
            ),
            new Claim(
                ClaimTypes.Name,
                user.UserName
            ),
            new Claim(
                "EmployeeNo",
                user.EmployeeNo
            )
        };

        claims.AddRange(
    roles.Select(
        role => new Claim(ClaimTypes.Role, role)
    )
);

        var securityKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtKey)
        );

        var credentials = new SigningCredentials(
            securityKey,
            SecurityAlgorithms.HmacSha256
        );

        var expiresAt = DateTime.UtcNow.AddMinutes(expireMinutes);

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials
        );

        string tokenText =
            new JwtSecurityTokenHandler().WriteToken(token);

        return Ok(new
        {
            success = true,
            message = "登入成功",
            token = tokenText,
            expiresAt = expiresAt,
            user = new
            {
                user.UserId,
                user.EmployeeNo,
                user.UserName,
                roles
            }
        });
    }

    [Authorize]
    [HttpGet("me")]
    public IActionResult GetCurrentUser()
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        var userName = User.FindFirstValue(
            ClaimTypes.Name
        );

        var employeeNo = User.FindFirstValue(
            "EmployeeNo"
        );

        var roles = User.FindAll(ClaimTypes.Role)
    .Select(claim => claim.Value)
    .ToList();

        return Ok(new
        {
            success = true,
            message = "JWT 驗證成功",
            user = new
            {
                userId,
                employeeNo,
                userName,
                roles
            }
        });
    }

    [Authorize(Roles = "ADMIN")]
    [HttpGet("admin-test")]
    public IActionResult AdminTest()
    {
        return Ok(new
        {
            success = true,
            message = "你具有 ADMIN 權限，可以使用管理者功能"
        });
    }
}