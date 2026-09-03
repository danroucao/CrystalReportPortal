using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ICrystalProcessService _crystalProcessService;

    public ReportsController(
        IReportService reportService,
        ICrystalProcessService crystalProcessService)
    {
        _reportService = reportService;
        _crystalProcessService = crystalProcessService;
    }

    [HttpGet]
    public async Task<IActionResult> GetReports()
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var result =
            await _reportService
                .GetReportsAsync(roleCodes);

        return Ok(result);
    }

    [HttpGet("{reportId:long}/execute-access")]
    public async Task<IActionResult> CheckExecuteAccess(
        long reportId)
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var allowed =
            await _reportService
                .CanExecuteReportAsync(
                    reportId,
                    roleCodes);

        if (!allowed)
        {
            return Forbid();
        }

        return Ok(new
        {
            success = true,
            message = "具有執行此報表的權限",
            reportId
        });
    }

    [HttpGet("{reportId:long}/parameters")]
    public async Task<IActionResult> GetParameters(
    long reportId)
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var allowed =
            await _reportService
                .CanExecuteReportAsync(
                    reportId,
                    roleCodes);

        if (!allowed)
        {
            return Forbid();
        }

        var result =
            await _reportService
                .GetReportParametersAsync(
                    reportId,
                    roleCodes);

        return Ok(result);
    }

    [HttpGet("{reportId:long}/parameters/{parameterId:long}/options")]
    public async Task<IActionResult> GetParameterOptions(
        long reportId,
        long parameterId)
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var allowed =
            await _reportService.CanExecuteReportAsync(
                reportId,
                roleCodes);

        if (!allowed)
        {
            return Forbid();
        }

        var result =
            await _reportService.GetParameterOptionsAsync(
                reportId,
                parameterId,
                roleCodes);

        return Ok(result);
    }

    [Authorize(Roles = "ADMIN")]
    [HttpGet("test-crystal-parameters")]
    public async Task<IActionResult> TestCrystalParameters()
    {
        var rptPath =
            @"C:\GitHub\CrystalReportPortal\reports\參數練習-零售銷售明細.rpt";

        var result = await _crystalProcessService
            .GetParametersAsync(rptPath);

        return Ok(result);
    }

    [Authorize(Roles = "ADMIN")]
    [HttpPost("{reportId:long}/rpt")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadRpt(
    long reportId,
    IFormFile file)
    {
        if (file == null ||
            file.Length == 0)
        {
            return BadRequest(new
            {
                success = false,
                message = "請選擇 RPT 檔案。"
            });
        }

        var userIdValue =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (!long.TryParse(
            userIdValue,
            out var userId))
        {
            return Unauthorized();
        }

        var result =
            await _reportService.UploadRptAsync(
                reportId,
                file,
                userId);

        return Ok(result);
    }
}