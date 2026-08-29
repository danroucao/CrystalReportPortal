using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReportSystem.Api.Data;
using System.Security.Claims;

namespace ReportSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly ReportSystemDbContext _dbContext;

    public ReportsController(
        ReportSystemDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetReports()
    {
        var roleCodes = User
            .FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .ToList();

        if (roleCodes.Count == 0)
        {
            return Ok(new
            {
                success = true,
                count = 0,
                reports = Array.Empty<object>()
            });
        }

        var reports = await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .Where(permission =>
                roleCodes.Contains(permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.Report.IsEnabled &&
                permission.Report.Category.IsEnabled
            )
            .GroupBy(permission => new
            {
                permission.Report.ReportId,
                permission.Report.ReportCode,
                permission.Report.ReportName,
                permission.Report.Description,
                permission.Report.Category.CategoryId,
                permission.Report.Category.CategoryName
            })
            .Select(group => new
            {
                group.Key.ReportId,
                group.Key.ReportCode,
                group.Key.ReportName,
                group.Key.Description,

                category = new
                {
                    group.Key.CategoryId,
                    group.Key.CategoryName
                },

                permissions = new
                {
                    canExecute = group.Any(
                        permission => permission.CanExecute
                    ),

                    canExport = group.Any(
                        permission => permission.CanExport
                    ),

                    canPrint = group.Any(
                        permission => permission.CanPrint
                    )
                }
            })
            .OrderBy(report => report.category.CategoryName)
            .ThenBy(report => report.ReportName)
            .ToListAsync();

        return Ok(new
        {
            success = true,
            count = reports.Count,
            reports
        });
    }
}