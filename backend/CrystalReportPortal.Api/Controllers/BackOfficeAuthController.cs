using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/backoffice-auth")]
public class BackOfficeAuthController : ControllerBase
{
    private readonly IBackOfficeAuthService _backOfficeAuthService;

    public BackOfficeAuthController(
        IBackOfficeAuthService backOfficeAuthService)
    {
        _backOfficeAuthService = backOfficeAuthService;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(
        BackOfficeLoginRequest request)
    {
        var result =
            await _backOfficeAuthService.LoginAsync(request);

        if (!result.Success)
        {
            return Unauthorized(result);
        }

        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("verify-operator")]
    public async Task<IActionResult> VerifyOperator(
    BackOfficeOperatorRequest request)
    {
        var result =
            await _backOfficeAuthService
                .VerifyOperatorAsync(request);

        if (!result.Success)
        {
            return Unauthorized(result);
        }

        return Ok(result);
    }
}