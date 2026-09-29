using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CrystalReportPortal.Api.Controllers;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CrystalReportPortal.Api.Tests;

public class FavoriteReportsControllerTests
{
    [Fact]
    public async Task Get_ReturnsOnlyTheCurrentUsersFavorites()
    {
        await using var db = CreateDbContext();
        db.UserFavoriteReports.AddRange(
            Favorite(userId: 1, reportId: 11),
            Favorite(userId: 2, reportId: 22));
        await db.SaveChangesAsync();

        var result = await CreateController(db, canExecute: true, userId: 1).Get();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var items = Assert.IsAssignableFrom<IEnumerable<FavoriteReportDto>>(ok.Value);
        Assert.Collection(items, item => Assert.Equal(11, item.ReportId));
    }

    [Fact]
    public async Task Add_ForbidsReportsTheUserCannotExecute()
    {
        await using var db = CreateDbContext();

        var result = await CreateController(db, canExecute: false, userId: 1).Add(11);

        Assert.IsType<ForbidResult>(result);
        Assert.Empty(db.UserFavoriteReports);
    }

    [Fact]
    public async Task Remove_OnlyRemovesTheCurrentUsersFavorite()
    {
        await using var db = CreateDbContext();
        db.UserFavoriteReports.AddRange(
            Favorite(userId: 1, reportId: 11),
            Favorite(userId: 2, reportId: 11));
        await db.SaveChangesAsync();

        var result = await CreateController(db, canExecute: true, userId: 1).Remove(11);

        Assert.IsType<NoContentResult>(result);
        Assert.DoesNotContain(db.UserFavoriteReports, item => item.UserId == 1 && item.ReportId == 11);
        Assert.Contains(db.UserFavoriteReports, item => item.UserId == 2 && item.ReportId == 11);
    }

    [Fact]
    public async Task RecordUsage_OnlyUpdatesTheCurrentUsersFavorite()
    {
        await using var db = CreateDbContext();
        var previous = DateTime.UtcNow.AddDays(-1);
        db.UserFavoriteReports.AddRange(
            Favorite(userId: 1, reportId: 11, lastUsedAt: previous),
            Favorite(userId: 2, reportId: 11, lastUsedAt: previous));
        await db.SaveChangesAsync();

        var result = await CreateController(db, canExecute: true, userId: 1).RecordUsage(11);

        Assert.IsType<NoContentResult>(result);
        var currentUser = await db.UserFavoriteReports.SingleAsync(item => item.UserId == 1);
        var otherUser = await db.UserFavoriteReports.SingleAsync(item => item.UserId == 2);
        Assert.True(currentUser.LastUsedAt > previous);
        Assert.Equal(previous, otherUser.LastUsedAt);
    }

    private static AppDbContext CreateDbContext() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static UserFavoriteReport Favorite(long userId, long reportId, DateTime? lastUsedAt = null) => new()
    {
        UserId = userId,
        ReportId = reportId,
        FavoritedAt = DateTime.UtcNow.AddDays(-2),
        LastUsedAt = lastUsedAt,
    };

    private static FavoriteReportsController CreateController(AppDbContext db, bool canExecute, long userId) => new(db, new TestReportService(canExecute))
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, "TEST")],
                    "test"))
            }
        }
    };

    private sealed class TestReportService(bool canExecute) : IReportService
    {
        public Task<bool> CanExecuteReportAsync(long reportId, List<string> roleCodes) => Task.FromResult(canExecute);
        public Task<ReportListResponse> GetReportsAsync(List<string> roleCodes) => Task.FromResult<ReportListResponse>(null!);
        public Task<ReportParameterResponse> GetReportParametersAsync(long reportId, List<string> roleCodes) => Task.FromResult<ReportParameterResponse>(null!);
        public Task<ParameterOptionResponse> GetParameterOptionsAsync(long reportId, long parameterId, List<string> roleCodes) => Task.FromResult<ParameterOptionResponse>(null!);
        public Task<ParameterOptionResponse> GetParameterOptionsForManagementAsync(long reportId, long parameterId) => Task.FromResult<ParameterOptionResponse>(null!);
        public Task<RptUploadResponse> UploadRptAsync(long reportId, IFormFile file, long userId) => Task.FromResult<RptUploadResponse>(null!);
        public Task<bool> CanUploadReportAsync(long reportId, List<string> roleCodes) => Task.FromResult(false);
        public Task<bool> CanExportReportAsync(long reportId, List<string> roleCodes) => Task.FromResult(false);
        public Task<bool> CanPrintReportAsync(long reportId, List<string> roleCodes) => Task.FromResult(false);
        public Task<bool> CanMaintainReportAsync(long reportId, List<string> roleCodes) => Task.FromResult(false);
        public Task<bool> CanSetParametersReportAsync(long reportId, List<string> roleCodes) => Task.FromResult(false);
        public Task<bool> CanEnableDisableReportAsync(long reportId, List<string> roleCodes) => Task.FromResult(false);
    }
}
