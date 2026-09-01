using Microsoft.AspNetCore.Mvc;
using ReportSystem.Api.Dtos;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using ReportSystem.Api.Services;

namespace ReportSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);

        if (!result.Success)
        {
            if (result.PasswordExpired)
            {
                return StatusCode(StatusCodes.Status403Forbidden, result);
            }

            return Unauthorized(result);
        }

        return Ok(result);
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var result = await _authService.ChangePasswordAsync(request);

        if (!result.Success)
        {
            return Unauthorized(result);
        }

        return Ok(result);
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
