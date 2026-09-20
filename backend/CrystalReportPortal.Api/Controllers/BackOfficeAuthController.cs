using System.Globalization;
using CrystalReportPortal.Api.Authorization;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/backoffice-auth")]
public class BackOfficeAuthController : ControllerBase
{
    private const int MaximumOperatorFailures = 3;

    private static readonly TimeSpan
        SharedVerificationLifetime =
            TimeSpan.FromMinutes(5);

    private readonly IBackOfficeAuthService
        _backOfficeAuthService;

    public BackOfficeAuthController(
        IBackOfficeAuthService backOfficeAuthService)
    {
        _backOfficeAuthService =
            backOfficeAuthService;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(
    BackOfficeLoginRequest request)
    {
        var result =
            await _backOfficeAuthService
                .LoginAsync(request);

        if (!result.Success)
        {
            return Unauthorized(result);
        }

        return Ok(result);
    }

    [Authorize(Policy = "BackOfficeFirstStage")]
    [HttpPost("verify-operator")]
    public async Task<IActionResult> VerifyOperator(
        BackOfficeOperatorLoginRequest request)
    {
        var result =
            await _backOfficeAuthService
                .VerifyOperatorAsync(request);

        if (!result.Success)
        {
            var failureCount =
                (HttpContext.Session.GetInt32(
                    BackOfficeSessionKeys
                        .OperatorVerifyFailedCount)
                 ?? 0) + 1;

            if (failureCount >=
                MaximumOperatorFailures)
            {
                BackOfficeSessionKeys
                    .ClearSharedVerification(
                        HttpContext.Session);

                result.Message +=
                    "；操作者驗證失敗次數已達上限，"
                    + "請重新輸入共用後台帳密";
            }
            else
            {
                HttpContext.Session.SetInt32(
                    BackOfficeSessionKeys
                        .OperatorVerifyFailedCount,
                    failureCount);
            }

            return Unauthorized(result);
        }

        var operatorInfo =
            result.Operator;

        if (operatorInfo == null)
        {
            BackOfficeSessionKeys.ClearAll(
                HttpContext.Session);

            return StatusCode(
                StatusCodes
                    .Status500InternalServerError,
                new BackOfficeOperatorResponse
                {
                    Success = false,
                    Message =
                        "驗證結果缺少操作者資料"
                });
        }

        HttpContext.Session.SetString(
            BackOfficeSessionKeys.OperatorUserId,
            operatorInfo.UserId.ToString(
                CultureInfo.InvariantCulture));

        HttpContext.Session.SetString(
            BackOfficeSessionKeys.OperatorAccount,
            operatorInfo.Account);

        HttpContext.Session.SetString(
            BackOfficeSessionKeys.OperatorUserName,
            operatorInfo.UserName);

        BackOfficeSessionKeys
            .ClearSharedVerification(
                HttpContext.Session);

        return Ok(result);
    }

    [Authorize(Policy = "BackOffice")]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var operatorUserIdText =
            HttpContext.Session.GetString(
                BackOfficeSessionKeys.OperatorUserId);

        long.TryParse(
            operatorUserIdText,
            out var operatorUserId);

        BackOfficeSessionKeys.ClearAll(
            HttpContext.Session);

        if (operatorUserId > 0)
        {
            await _backOfficeAuthService
                .LogLogoutAsync(operatorUserId);
        }

        return Ok(new
        {
            success = true,
            message = "後台登出成功"
        });
    }

    private bool IsSharedVerificationValid()
    {
        var verifiedAtText =
            HttpContext.Session.GetString(
                BackOfficeSessionKeys
                    .SharedVerifiedAtUtc);

        if (!long.TryParse(
                verifiedAtText,
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var verifiedAtUnix))
        {
            return false;
        }

        DateTimeOffset verifiedAt;

        try
        {
            verifiedAt =
                DateTimeOffset
                    .FromUnixTimeSeconds(
                        verifiedAtUnix);
        }
        catch (ArgumentOutOfRangeException)
        {
            return false;
        }

        var elapsed =
            DateTimeOffset.UtcNow - verifiedAt;

        return elapsed >= TimeSpan.Zero &&
               elapsed <=
                   SharedVerificationLifetime;
    }
}