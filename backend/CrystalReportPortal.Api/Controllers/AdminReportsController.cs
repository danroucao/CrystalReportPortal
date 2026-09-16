using System.Security.Claims;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Policy = "BackOffice")]
public class AdminReportsController : ControllerBase
{
    private readonly AppDbContext db;
    public AdminReportsController(AppDbContext db) => this.db = db;

    [HttpGet]
    public async Task<ActionResult<List<AdminReportDto>>> GetReports() => Ok(await db.Reports.AsNoTracking().OrderBy(x => x.ReportName)
        .Select(x => new AdminReportDto { ReportId = x.ReportId, ReportCode = x.ReportCode, ReportName = x.ReportName, Description = x.Description, IsEnabled = x.IsEnabled, RptFileName = x.RptFileName }).ToListAsync());

    [HttpGet("categories")]
    public async Task<ActionResult<List<CategoryOptionDto>>> GetCategories() => Ok(await db.ReportCategories.AsNoTracking().Where(x => x.IsEnabled).OrderBy(x => x.DisplayOrder)
        .Select(x => new CategoryOptionDto { CategoryId = x.CategoryId, CategoryName = x.CategoryName }).ToListAsync());

    [HttpGet("data-sources")]
    public async Task<ActionResult<List<DataSourceOptionDto>>> GetDataSources() => Ok(await db.ReportDataSources.AsNoTracking().Where(x => x.IsEnabled).OrderBy(x => x.DataSourceName)
        .Select(x => new DataSourceOptionDto { DataSourceId = x.DataSourceId, DataSourceName = x.DataSourceName }).ToListAsync());

    [HttpPost]
    public async Task<ActionResult<AdminReportDto>> CreateReport(
        CreateReportRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ReportCode) ||
            string.IsNullOrWhiteSpace(request.ReportName))
        {
            return BadRequest(new
            {
                message = "Report code and name are required."
            });
        }

        if (await db.Reports.AnyAsync(
                x => x.ReportCode == request.ReportCode))
        {
            return Conflict(new
            {
                message = "The report code already exists."
            });
        }

        var category =
            await db.ReportCategories
                .FirstOrDefaultAsync(
                    x =>
                        x.CategoryId == request.CategoryId &&
                        x.IsEnabled);

        if (category == null)
        {
            return BadRequest(new
            {
                message = "Category is invalid."
            });
        }

        var dataSourceExists =
            await db.ReportDataSources
                .AnyAsync(
                    x =>
                        x.DataSourceId == request.DataSourceId &&
                        x.IsEnabled);

        if (!dataSourceExists)
        {
            return BadRequest(new
            {
                message = "Data source is invalid."
            });
        }

        if (!long.TryParse(
        HttpContext.Session.GetString(
            "BackOffice.OperatorUserId"),
        out var userId))
        {
            return Unauthorized();
        }

        // ==========================================
        // 建立 Report
        // ==========================================

        var report =
            new Report
            {
                ReportCode =
                    request.ReportCode.Trim(),

                ReportName =
                    request.ReportName.Trim(),

                Description =
                    request.Description?.Trim(),

                CategoryId =
                    request.CategoryId,

                DataSourceId =
                    request.DataSourceId,

                CredentialType =
                    request.CredentialType,

                RptFileName =
                    string.Empty,

                RptFilePath =
                    string.Empty,

                IsEnabled =
                    true,

                CreatedBy =
                    userId,

                CreatedAt =
                    DateTime.UtcNow
            };

        db.Reports.Add(report);

        // ==========================================
        // ADMIN 一律擁有報表權限
        // ==========================================

        var adminRole =
            await db.Roles
                .SingleOrDefaultAsync(
                    x =>
                        x.RoleCode == "ADMIN" &&
                        x.IsEnabled);

        if (adminRole != null)
        {
            db.RoleReportPermissions.Add(
                new RoleReportPermission
                {
                    RoleId =
                        adminRole.RoleId,

                    Report =
                        report,

                    CanExecute =
                        true,

                    CanExport =
                        true,

                    CanPrint =
                        true,

                    CreatedAt =
                        DateTime.UtcNow
                });
        }

        // ==========================================
        // 財務分類 → 自動授權 FINANCE
        // ==========================================

        if (string.Equals(
                category.CategoryName,
                "財務",
                StringComparison.OrdinalIgnoreCase))
        {
            var financeRole =
                await db.Roles
                    .SingleOrDefaultAsync(
                        x =>
                            x.RoleCode == "FINANCE" &&
                            x.IsEnabled);

            if (financeRole != null)
            {
                db.RoleReportPermissions.Add(
                    new RoleReportPermission
                    {
                        RoleId =
                            financeRole.RoleId,

                        Report =
                            report,

                        CanExecute =
                            true,

                        CanExport =
                            true,

                        CanPrint =
                            true,

                        CreatedAt =
                            DateTime.UtcNow
                    });
            }
        }

        // ==========================================
        // 一次寫入 Report + Permissions
        // ==========================================

        await db.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetReports),
            new
            {
                reportId =
                    report.ReportId
            },
            new AdminReportDto
            {
                ReportId =
                    report.ReportId,

                ReportCode =
                    report.ReportCode,

                ReportName =
                    report.ReportName,

                Description =
                    report.Description,

                IsEnabled =
                    report.IsEnabled,

                RptFileName =
                    report.RptFileName
            });
    }
}
