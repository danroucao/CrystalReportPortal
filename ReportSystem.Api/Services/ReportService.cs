using Microsoft.EntityFrameworkCore;
using ReportSystem.Api.Data;
using ReportSystem.Api.Dtos;

namespace ReportSystem.Api.Services;

public class ReportService : IReportService
{
    private readonly ReportSystemDbContext _dbContext;

    public ReportService(ReportSystemDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ReportListResponse> GetReportsAsync(
        List<string> roleCodes)
    {
        if (roleCodes.Count == 0)
        {
            return new ReportListResponse();
        }

        var reports = await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .Where(permission =>
                roleCodes.Contains(permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.Report.IsEnabled &&
                permission.Report.Category.IsEnabled &&
                (permission.CanExecute ||
                 permission.CanExport ||
                 permission.CanPrint))
            .GroupBy(permission => new
            {
                permission.Report.ReportId,
                permission.Report.ReportCode,
                permission.Report.ReportName,
                permission.Report.Description,
                permission.Report.Category.CategoryId,
                permission.Report.Category.CategoryName
            })
            .Select(group => new ReportDto
            {
                ReportId = group.Key.ReportId,
                ReportCode = group.Key.ReportCode,
                ReportName = group.Key.ReportName,
                Description = group.Key.Description,
                Category = new ReportCategoryDto
                {
                    CategoryId = group.Key.CategoryId,
                    CategoryName = group.Key.CategoryName
                },
                Permissions = new ReportPermissionDto
                {
                    CanExecute = group.Any(permission => permission.CanExecute),
                    CanExport = group.Any(permission => permission.CanExport),
                    CanPrint = group.Any(permission => permission.CanPrint)
                }
            })
            .OrderBy(report => report.Category.CategoryName)
            .ThenBy(report => report.ReportName)
            .ToListAsync();

        return new ReportListResponse
        {
            Reports = reports
        };
    }

    public async Task<bool> CanExecuteReportAsync(
        long reportId,
        List<string> roleCodes)
    {
        return await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .AnyAsync(permission =>
                permission.ReportId == reportId &&
                roleCodes.Contains(permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.Report.IsEnabled &&
                permission.Report.Category.IsEnabled &&
                permission.CanExecute);
    }
}