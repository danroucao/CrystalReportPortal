using System.Security.Claims;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<UserNotificationDto>>> GetNotifications(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int take = 50)
    {
        var userId = GetCurrentUserId();
        if (userId is null) return Unauthorized();

        take = Math.Clamp(take, 1, 100);
        var query = db.UserNotifications.AsNoTracking()
            .Where(item => item.RecipientUserId == userId.Value);
        if (unreadOnly) query = query.Where(item => item.ReadAt == null);

        var notifications = await query
            .OrderByDescending(item => item.CreatedAt)
            .Take(take)
            .Select(item => new UserNotificationDto
            {
                NotificationId = item.NotificationId,
                Title = item.Title,
                Summary = item.Summary,
                Detail = item.Detail,
                TargetPath = item.TargetPath,
                CreatedAt = item.CreatedAt,
                ReadAt = item.ReadAt
            })
            .ToListAsync();

        foreach (var notification in notifications)
        {
            notification.CreatedAt = UtcTimestamp.Restore(notification.CreatedAt);
            notification.ReadAt = UtcTimestamp.Restore(notification.ReadAt);
        }

        return Ok(notifications);
    }

    [HttpPut("{notificationId:long}/read")]
    public async Task<IActionResult> MarkRead(long notificationId)
    {
        var userId = GetCurrentUserId();
        if (userId is null) return Unauthorized();
        var notification = await db.UserNotifications.SingleOrDefaultAsync(item =>
            item.NotificationId == notificationId && item.RecipientUserId == userId.Value);
        if (notification is null) return NotFound();
        if (notification.ReadAt is null)
        {
            notification.ReadAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var userId = GetCurrentUserId();
        if (userId is null) return Unauthorized();
        await db.UserNotifications
            .Where(item => item.RecipientUserId == userId.Value && item.ReadAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.ReadAt, DateTime.UtcNow));
        return NoContent();
    }

    [HttpDelete("read")]
    public async Task<IActionResult> DeleteRead()
    {
        var userId = GetCurrentUserId();
        if (userId is null) return Unauthorized();
        await db.UserNotifications
            .Where(item => item.RecipientUserId == userId.Value && item.ReadAt != null)
            .ExecuteDeleteAsync();
        return NoContent();
    }

    private long? GetCurrentUserId() => long.TryParse(
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId)
        ? userId
        : null;
}
