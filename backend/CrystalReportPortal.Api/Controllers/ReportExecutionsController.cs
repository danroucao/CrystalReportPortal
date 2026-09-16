using System.Security.Claims;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportExecutionsController : ControllerBase
{
    private readonly IReportExecutionService _executions;
    private readonly IReportService _reportService;

    public ReportExecutionsController(
    IReportExecutionService executions,
    IReportService reportService)
    {
        _executions = executions;
        _reportService = reportService;
    }

    [HttpPost("{reportId:long}/execute")]
    public async Task<IActionResult> Execute(
        long reportId,
        ReportExecutionRequest request)
    {
        var userIdText =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (!long.TryParse(
                userIdText,
                out var userId))
        {
            return Unauthorized();
        }

        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        var canExecute =
            await _reportService.CanExecuteReportAsync(
                reportId,
                roleCodes);

        if (!canExecute)
        {
            return Forbid();
        }

        var canExport =
            await _reportService.CanExportReportAsync(
                reportId,
                roleCodes);

        if (!canExport)
        {
            return Forbid();
        }

        var result =
            await _executions.ExecuteAsync(
                reportId,
                userId,
                roleCodes,
                request);

        Response.Headers.Append(
            "X-Report-Execution-Id",
            result.ExecutionId.ToString());

        return File(
            result.Pdf,
            "application/pdf",
            $"report-{reportId}-{result.ExecutionId:N}.pdf");
    }
}
