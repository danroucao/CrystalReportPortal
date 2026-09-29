using System.Security.Claims;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Entities;
using CrystalReportPortal.Api.Services;
using CrystalReportPortal.Api.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/reports/favorites")]
public sealed class FavoriteReportsController(
    AppDbContext db,
    IReportService reports) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FavoriteReportDto>>> Get()
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var items = await db.UserFavoriteReports.AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderByDescending(item => item.LastUsedAt ?? item.FavoritedAt)
            .Select(item => new FavoriteReportDto(
                item.ReportId,
                item.FavoritedAt,
                item.LastUsedAt))
            .ToListAsync();

        return Ok(items.Select(item => item with
        {
            FavoritedAt = UtcTimestamp.Restore(item.FavoritedAt),
            LastUsedAt = UtcTimestamp.Restore(item.LastUsedAt),
        }));
    }

    [HttpPut("{reportId:long}")]
    public async Task<IActionResult> Add(long reportId)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        if (!await CanUseReportAsync(reportId)) return Forbid();

        var exists = await db.UserFavoriteReports.AnyAsync(item =>
            item.UserId == userId && item.ReportId == reportId);
        if (!exists)
        {
            db.UserFavoriteReports.Add(new UserFavoriteReport
            {
                UserId = userId,
                ReportId = reportId,
                FavoritedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpDelete("{reportId:long}")]
    public async Task<IActionResult> Remove(long reportId)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var favorite = await db.UserFavoriteReports.SingleOrDefaultAsync(item =>
            item.UserId == userId && item.ReportId == reportId);
        if (favorite is not null)
        {
            db.UserFavoriteReports.Remove(favorite);
            await db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpPut("{reportId:long}/last-used")]
    public async Task<IActionResult> RecordUsage(long reportId)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        if (!await CanUseReportAsync(reportId)) return Forbid();

        var favorite = await db.UserFavoriteReports.SingleOrDefaultAsync(item =>
            item.UserId == userId && item.ReportId == reportId);
        if (favorite is not null)
        {
            favorite.LastUsedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        return NoContent();
    }

    private bool TryGetUserId(out long userId) => long.TryParse(
        User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    private Task<bool> CanUseReportAsync(long reportId) => reports.CanExecuteReportAsync(
        reportId,
        User.FindAll(ClaimTypes.Role).Select(claim => claim.Value).ToList());
}

public sealed record FavoriteReportDto(
    long ReportId,
    DateTime FavoritedAt,
    DateTime? LastUsedAt);
