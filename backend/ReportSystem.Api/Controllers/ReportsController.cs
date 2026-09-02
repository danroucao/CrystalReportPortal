using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ReportSystem.Api.Services;
using System.Security.Claims;

namespace ReportSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet]
    public async Task<IActionResult> GetReports()
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var result = await _reportService.GetReportsAsync(roleCodes);

        return Ok(result);
    }

    [HttpGet("{reportId:long}/execute-access")]
    public async Task<IActionResult> CheckExecuteAccess(long reportId)
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var allowed = await _reportService.CanExecuteReportAsync(reportId, roleCodes);

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
}
