using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/backoffice/users")]
[Authorize(Policy = "BackOffice")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext db;
    public UsersController(AppDbContext db) => this.db = db;

    [HttpGet]
    public async Task<ActionResult<List<ManagedUserDto>>> GetUsers() => Ok(await db.Users.AsNoTracking()
        .Include(user => user.UserRoles).ThenInclude(userRole => userRole.Role)
        .OrderBy(user => user.Account)
        .Select(user => new ManagedUserDto
        {
            UserId = user.UserId, EmployeeNo = user.EmployeeNo, Account = user.Account,
            UserName = user.UserName, IsEnabled = user.IsEnabled,
            RoleCodes = user.UserRoles.Where(userRole => userRole.Role.IsEnabled)
                .Select(userRole => userRole.Role.RoleCode).ToList()
        }).ToListAsync());

    [HttpGet("roles")]
    public async Task<ActionResult<List<RoleOptionDto>>> GetRoles() => Ok(await db.Roles.AsNoTracking()
        .Where(role => role.IsEnabled).OrderBy(role => role.RoleName)
        .Select(role => new RoleOptionDto { RoleCode = role.RoleCode, RoleName = role.RoleName })
        .ToListAsync());

    [HttpPut("{userId:long}/roles")]
    public async Task<ActionResult<ManagedUserDto>> UpdateUserRoles(long userId, UpdateUserRolesRequest request)
    {
        var user = await db.Users.Include(candidate => candidate.UserRoles)
            .SingleOrDefaultAsync(candidate => candidate.UserId == userId);
        if (user == null) return NotFound(new { message = "User not found." });

        var requestedCodes = request.RoleCodes.Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var roles = await db.Roles.Where(role => role.IsEnabled && requestedCodes.Contains(role.RoleCode)).ToListAsync();
        if (roles.Count != requestedCodes.Count)
            return BadRequest(new { message = "One or more roles are invalid or disabled." });

        var requestedIds = roles.Select(role => role.RoleId).ToHashSet();
        db.UserRoles.RemoveRange(user.UserRoles.Where(userRole => !requestedIds.Contains(userRole.RoleId)));
        foreach (var role in roles.Where(role => user.UserRoles.All(userRole => userRole.RoleId != role.RoleId)))
            user.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = role.RoleId, CreatedAt = DateTime.UtcNow });

        user.TokenVersion += 1;
        user.UpdatedAt = DateTime.UtcNow;
        AddAudit("UPDATE_USER_ROLES", $"Updated AD user roles: {user.Account} => [{string.Join(", ", roles.Select(role => role.RoleCode).OrderBy(code => code))}]");
        await db.SaveChangesAsync();
        return Ok(ToDto(user, roles));
    }

    [HttpPut("{userId:long}/status")]
    public async Task<ActionResult<ManagedUserDto>> UpdateUserStatus(long userId, UpdateManagedUserStatusRequest request)
    {
        var user = await db.Users.Include(candidate => candidate.UserRoles).ThenInclude(userRole => userRole.Role)
            .SingleOrDefaultAsync(candidate => candidate.UserId == userId);
        if (user == null) return NotFound(new { message = "User not found." });

        user.IsEnabled = request.IsEnabled;
        user.TokenVersion += 1;
        user.UpdatedAt = DateTime.UtcNow;
        AddAudit("UPDATE_USER_STATUS", $"Updated AD user status: {user.Account} => {(user.IsEnabled ? "enabled" : "disabled")}");
        await db.SaveChangesAsync();
        return Ok(new ManagedUserDto
        {
            UserId = user.UserId, EmployeeNo = user.EmployeeNo, Account = user.Account,
            UserName = user.UserName, IsEnabled = user.IsEnabled,
            RoleCodes = user.UserRoles.Where(userRole => userRole.Role.IsEnabled)
                .Select(userRole => userRole.Role.RoleCode).ToList()
        });
    }

    private static ManagedUserDto ToDto(User user, IEnumerable<Role> roles) => new()
    {
        UserId = user.UserId, EmployeeNo = user.EmployeeNo, Account = user.Account,
        UserName = user.UserName, IsEnabled = user.IsEnabled,
        RoleCodes = roles.Select(role => role.RoleCode).ToList()
    };

    private void AddAudit(string action, string details)
    {
        if (!long.TryParse(HttpContext.Session.GetString("BackOffice.OperatorUserId"), out var operatorId))
            throw new UnauthorizedAccessException("Unable to identify the back-office operator.");

        db.AuditLogs.Add(new AuditLog
        {
            UserId = operatorId, Action = action, Result = "SUCCESS",
            Details = $"Back-office operator {HttpContext.Session.GetString("BackOffice.OperatorAccount")}: {details}",
            CreatedAt = DateTime.UtcNow
        });
    }
}
