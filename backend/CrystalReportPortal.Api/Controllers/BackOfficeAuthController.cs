using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;

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
        // 重新登入時，先清除上一次的後台登入狀態
        HttpContext.Session.Remove("BackOffice.SharedVerified");
        HttpContext.Session.Remove("BackOffice.OperatorUserId");
        HttpContext.Session.Remove("BackOffice.OperatorAccount");
        HttpContext.Session.Remove("BackOffice.OperatorUserName");

        // 比對共用後台帳密
        var result =
            await _backOfficeAuthService.LoginAsync(request);

        if (!result.Success)
        {
            return Unauthorized(result);
        }

        // 帳密正確：由伺服器記住第一關已通過
        HttpContext.Session.SetString(
            "BackOffice.SharedVerified",
            "true");

        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("verify-operator")]
    public async Task<IActionResult> VerifyOperator(
    BackOfficeOperatorLoginRequest request)
    {
        // 讀取第一關是否通過
        var sharedVerified =
            HttpContext.Session.GetString(
                "BackOffice.SharedVerified");

        // 沒通過第一關，不能進行個人帳密比對
        if (sharedVerified != "true")
        {
            return Unauthorized(new BackOfficeOperatorResponse
            {
                Success = false,
                Message = "請先完成共用後台帳密驗證"
            });
        }

        // 查資料庫，比對個人帳密
        var result =
            await _backOfficeAuthService.VerifyOperatorAsync(request);

        if (!result.Success)
        {
            return Unauthorized(result);
        }

        var operatorInfo = result.Operator;

        // 避免 Service 回傳成功，卻沒有操作者資料
        if (operatorInfo == null)
        {
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new BackOfficeOperatorResponse
                {
                    Success = false,
                    Message = "驗證結果缺少操作者資料"
                });
        }

        // 驗證成功，記住實際操作者
        HttpContext.Session.SetString(
            "BackOffice.OperatorUserId",
            operatorInfo.UserId.ToString());

        HttpContext.Session.SetString(
            "BackOffice.OperatorAccount",
            operatorInfo.Account);

        HttpContext.Session.SetString(
            "BackOffice.OperatorUserName",
            operatorInfo.UserName);

        // 第一關的通關狀態已用完
        // 如要換另一位操作者，必須重新走第一關
        HttpContext.Session.Remove(
            "BackOffice.SharedVerified");

        return Ok(result);
    }
    [Authorize(Policy = "BackOffice")]
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        HttpContext.Session.Remove(
            "BackOffice.SharedVerified");

        HttpContext.Session.Remove(
            "BackOffice.OperatorUserId");

        HttpContext.Session.Remove(
            "BackOffice.OperatorAccount");

        HttpContext.Session.Remove(
            "BackOffice.OperatorUserName");

        return Ok(new
        {
            success = true,
            message = "後台登出成功"
        });
    }
}