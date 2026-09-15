using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Policy = "BackOffice")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext db;
    public UsersController(AppDbContext db) => this.db = db;

    [HttpGet]
    public async Task<ActionResult<List<ManagedUserDto>>> GetUsers() => Ok(await db.Users.AsNoTracking()
        .Include(x => x.UserRoles).ThenInclude(x => x.Role)
        .OrderBy(x => x.Account)
        .Select(x => new ManagedUserDto { UserId = x.UserId, EmployeeNo = x.EmployeeNo, Account = x.Account, UserName = x.UserName, IsEnabled = x.IsEnabled, RoleCodes = x.UserRoles.Where(r => r.Role.IsEnabled).Select(r => r.Role.RoleCode).ToList() })
        .ToListAsync());

    [HttpGet("roles")]
    public async Task<ActionResult<List<RoleOptionDto>>> GetRoles() => Ok(await db.Roles.AsNoTracking()
        .Where(x => x.IsEnabled).OrderBy(x => x.RoleName)
        .Select(x => new RoleOptionDto { RoleCode = x.RoleCode, RoleName = x.RoleName }).ToListAsync());

    [HttpPost]
    public async Task<ActionResult<ManagedUserDto>> CreateUser(CreateUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.EmployeeNo) || string.IsNullOrWhiteSpace(request.Account) || string.IsNullOrWhiteSpace(request.UserName))
            return BadRequest(new { message = "Employee number, account, and user name are required." });
        if (request.InitialPassword.Length < 8 || !request.InitialPassword.Any(char.IsLetter) || !request.InitialPassword.Any(char.IsDigit))
            return BadRequest(new { message = "The initial password must be at least 8 characters and contain letters and digits." });
        if (await db.Users.AnyAsync(x => x.Account == request.Account || x.EmployeeNo == request.EmployeeNo))
            return Conflict(new { message = "The account or employee number already exists." });

        var codes = request.RoleCodes.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var roles = await db.Roles.Where(x => x.IsEnabled && codes.Contains(x.RoleCode)).ToListAsync();
        if (roles.Count != codes.Count) return BadRequest(new { message = "One or more roles are invalid." });

        var now = DateTime.UtcNow;
        var user = new User { EmployeeNo = request.EmployeeNo.Trim(), Account = request.Account.Trim(), UserName = request.UserName.Trim(), PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.InitialPassword), IsEnabled = request.IsEnabled, CreatedAt = now, PasswordChangedAt = now };
        foreach (var role in roles) user.UserRoles.Add(new UserRole { Role = role, CreatedAt = now });
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetUsers), new { userId = user.UserId }, new ManagedUserDto { UserId = user.UserId, EmployeeNo = user.EmployeeNo, Account = user.Account, UserName = user.UserName, IsEnabled = user.IsEnabled, RoleCodes = roles.Select(x => x.RoleCode).ToList() });
    }

    [HttpPut("{userId:long}/roles")]
    public async Task<IActionResult> UpdateUserRoles(
    long userId,
    UpdateUserRolesRequest request)
    {
        var user = await db.Users
            .Include(candidate => candidate.UserRoles)
            .FirstOrDefaultAsync(
                candidate =>
                    candidate.UserId == userId);

        if (user == null)
        {
            return NotFound(new
            {
                message = "找不到指定的使用者"
            });
        }

        var requestedRoleCodes = request.RoleCodes
            .Where(roleCode =>
                !string.IsNullOrWhiteSpace(roleCode))
            .Select(roleCode =>
                roleCode.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var roles = await db.Roles
            .Where(role =>
                role.IsEnabled &&
                requestedRoleCodes.Contains(role.RoleCode))
            .ToListAsync();

        if (roles.Count != requestedRoleCodes.Count)
        {
            return BadRequest(new
            {
                message = "包含不存在或已停用的角色"
            });
        }

        var requestedRoleIds = roles
            .Select(role => role.RoleId)
            .ToHashSet();

        // 移除這次沒有選擇的角色
        var userRolesToRemove = user.UserRoles
            .Where(userRole =>
                !requestedRoleIds.Contains(userRole.RoleId))
            .ToList();

        db.UserRoles.RemoveRange(userRolesToRemove);

        // 加入原本沒有的新角色
        foreach (var role in roles)
        {
            var alreadyAssigned = user.UserRoles
                .Any(userRole =>
                    userRole.RoleId == role.RoleId);

            if (!alreadyAssigned)
            {
                user.UserRoles.Add(
                    new UserRole
                    {
                        UserId = user.UserId,
                        RoleId = role.RoleId,
                        CreatedAt = DateTime.UtcNow
                    });
            }
        }

        // 讓使用者原本的前台 Token 失效
        user.TokenVersion += 1;
        user.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return Ok(new ManagedUserDto
        {
            UserId = user.UserId,
            EmployeeNo = user.EmployeeNo,
            Account = user.Account,
            UserName = user.UserName,
            IsEnabled = user.IsEnabled,
            RoleCodes = roles
                .Select(role => role.RoleCode)
                .ToList()
        });
    }
}
