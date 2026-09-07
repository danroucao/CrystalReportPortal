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
    private readonly IReportExecutionService executions;
    public ReportExecutionsController(IReportExecutionService executions) => this.executions = executions;

    [HttpPost("{reportId:long}/execute")]
    public async Task<IActionResult> Execute(long reportId, ReportExecutionRequest request)
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        var roles = User.FindAll(ClaimTypes.Role).Select(x => x.Value).ToList();
        var result = await executions.ExecuteAsync(reportId, userId, roles, request);
        Response.Headers.Append("X-Report-Execution-Id", result.ExecutionId.ToString());
        return File(result.Pdf, "application/pdf", $"report-{reportId}-{result.ExecutionId:N}.pdf");
    }
}
