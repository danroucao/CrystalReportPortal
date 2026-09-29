using System.Security.Claims;
using System.Text.Json;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Entities;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/reports/{reportId:long}/parameter-preferences")]
public sealed class ReportParameterPreferencesController(
    AppDbContext db,
    IReportService reports) : ControllerBase
{
    private const int MaxParametersJsonLength = 64 * 1024;
    [HttpGet("{preferenceType}")]
    public async Task<IActionResult> Get(long reportId, string preferenceType)
    {
        if (!TryGetUserId(out var userId) || !IsValidType(preferenceType)) return BadRequest();
        if (!await CanUseReportAsync(reportId)) return Forbid();

        var preference = await db.UserReportParameterPreferences.AsNoTracking().SingleOrDefaultAsync(x =>
            x.UserId == userId && x.ReportId == reportId && x.PreferenceType == preferenceType);
        return preference is null ? NotFound() : Ok(new { preference.ParametersJson, preference.UpdatedAt });
    }

    [HttpPut("{preferenceType}")]
    public async Task<IActionResult> Save(long reportId, string preferenceType, [FromBody] SavePreferenceRequest? request)
    {
        if (!TryGetUserId(out var userId) ||
            !IsValidType(preferenceType) ||
            !IsValidParametersJson(request?.ParametersJson))
        {
            return BadRequest(new
            {
                message = "參數偏好設定必須是大小不超過 64 KB 的 JSON 物件。"
            });
        }
        if (!await CanUseReportAsync(reportId)) return Forbid();

        var preference = await db.UserReportParameterPreferences.SingleOrDefaultAsync(x =>
            x.UserId == userId && x.ReportId == reportId && x.PreferenceType == preferenceType);
        if (preference is null)
        {
            preference = new UserReportParameterPreference { UserId = userId, ReportId = reportId, PreferenceType = preferenceType };
            db.UserReportParameterPreferences.Add(preference);
        }
        preference.ParametersJson = request!.ParametersJson;
        preference.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { preference.ParametersJson, preference.UpdatedAt });
    }

    private bool TryGetUserId(out long userId) => long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    private Task<bool> CanUseReportAsync(long reportId) => reports.CanExecuteReportAsync(
        reportId,
        User.FindAll(ClaimTypes.Role).Select(claim => claim.Value).ToList());

    private static bool IsValidType(string value) => value is "favorite" or "recent";

    private static bool IsValidParametersJson(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > MaxParametersJsonLength)
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(value);
            return document.RootElement.ValueKind == JsonValueKind.Object;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}

public sealed record SavePreferenceRequest(string ParametersJson);
