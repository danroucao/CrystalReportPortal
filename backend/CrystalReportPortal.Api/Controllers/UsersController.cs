using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;

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
        request.EmployeeNo = request.EmployeeNo?.Trim() ?? string.Empty;
        request.Account = request.Account?.Trim() ?? string.Empty;
        request.UserName = request.UserName?.Trim() ?? string.Empty;

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

        AddUserManagementAudit(
            "CREATE_USER",
            $"新增帳號={user.Account}，" +
            $"員工編號={user.EmployeeNo}，" +
            $"角色=[{string.Join(", ", roles.Select(role => role.RoleCode))}]");

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

        var originalRoleCodes = await db.UserRoles
    .Where(item => item.UserId == userId)
    .Select(item => item.Role.RoleCode)
    .OrderBy(code => code)
    .ToListAsync();

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

        AddUserManagementAudit(
            "UPDATE_USER_ROLES",
            $"對象UserId={user.UserId}，帳號={user.Account}；" +
            $"角色由 [{string.Join(", ", originalRoleCodes)}] " +
            $"改為 [{string.Join(", ", roles.Select(role => role.RoleCode).OrderBy(code => code))}]");

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

    // 修改使用者資料，以及啟用／停用帳號
    [HttpPut("{userId:long}/status")]
    public async Task<ActionResult<ManagedUserDto>> UpdateUserStatus(
        long userId,
        UpdateManagedUserStatusRequest request)
    {
        var user = await db.Users
            .Include(candidate => candidate.UserRoles)
            .ThenInclude(userRole => userRole.Role)
            .SingleOrDefaultAsync(candidate => candidate.UserId == userId);

        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        user.IsEnabled = request.IsEnabled;
        user.TokenVersion += 1;
        user.UpdatedAt = DateTime.UtcNow;

        AddUserManagementAudit(
            "UPDATE_USER_STATUS",
            $"Updated AD user status: {user.Account} => {(user.IsEnabled ? "enabled" : "disabled")}");

        await db.SaveChangesAsync();

        return Ok(new ManagedUserDto
        {
            UserId = user.UserId,
            EmployeeNo = user.EmployeeNo,
            Account = user.Account,
            UserName = user.UserName,
            IsEnabled = user.IsEnabled,
            RoleCodes = user.UserRoles
                .Where(userRole => userRole.Role.IsEnabled)
                .Select(userRole => userRole.Role.RoleCode)
                .ToList()
        });
    }

    [HttpPut("{userId:long}")]
    public async Task<IActionResult> UpdateUser(
        long userId,
        UpdateManagedUserRequest request)
    {
        var employeeNo = request.EmployeeNo.Trim();
        var account = request.Account.Trim();
        var userName = request.UserName.Trim();

        if (string.IsNullOrWhiteSpace(employeeNo) ||
            string.IsNullOrWhiteSpace(account) ||
            string.IsNullOrWhiteSpace(userName) ||
            !request.IsEnabled.HasValue)
        {
            return BadRequest(new
            {
                message = "員工編號、帳號、姓名與啟用狀態為必填"
            });
        }

        var user = await db.Users
            .SingleOrDefaultAsync(item => item.UserId == userId);

        if (user == null)
        {
            return NotFound(new
            {
                message = "找不到指定的使用者"
            });
        }

        var duplicate = await db.Users.AnyAsync(item =>
            item.UserId != userId &&
            (item.Account == account ||
             item.EmployeeNo == employeeNo));

        if (duplicate)
        {
            return Conflict(new
            {
                message = "帳號或員工編號已存在"
            });
        }

        var before =
            $"員工編號={user.EmployeeNo}，帳號={user.Account}，" +
            $"姓名={user.UserName}，啟用={user.IsEnabled}";

        user.EmployeeNo = employeeNo;
        user.Account = account;
        user.UserName = userName;
        user.IsEnabled = request.IsEnabled.Value;
        user.UpdatedAt = DateTime.UtcNow;

        // 舊的前台 JWT 立即失效
        user.TokenVersion += 1;

        AddUserManagementAudit(
            "UPDATE_USER",
            $"對象UserId={user.UserId}；" +
            $"修改前：[{before}]；" +
            $"修改後：[員工編號={user.EmployeeNo}，" +
            $"帳號={user.Account}，姓名={user.UserName}，" +
            $"啟用={user.IsEnabled}]");

        await db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            user.UserId,
            user.EmployeeNo,
            user.Account,
            user.UserName,
            user.IsEnabled
        });
    }

    // 後台重設指定使用者密碼
    [HttpPut("{userId:long}/password")]
    public async Task<IActionResult> ResetPassword(
        long userId,
        ResetUserPasswordRequest request)
    {
        var password = request.NewPassword;

        if (string.IsNullOrWhiteSpace(password) ||
            password.Length < 8 ||
            password.Length > 64 ||
            !password.Any(char.IsLetter) ||
            !password.Any(char.IsDigit) ||
            System.Text.Encoding.UTF8.GetByteCount(password) > 72)
        {
            return BadRequest(new
            {
                message =
                    "密碼須為 8～64 個字元，包含字母與數字，" +
                    "且 UTF-8 編碼不可超過 72 bytes"
            });
        }

        var user = await db.Users
            .SingleOrDefaultAsync(item => item.UserId == userId);

        if (user == null)
        {
            return NotFound(new
            {
                message = "找不到指定的使用者"
            });
        }

        var now = DateTime.UtcNow;

        user.PasswordHash =
            BCrypt.Net.BCrypt.HashPassword(password);

        user.PasswordChangedAt = now;
        user.UpdatedAt = now;

        // 密碼重設後，原本的前台 JWT 不可繼續使用
        user.TokenVersion += 1;

        AddUserManagementAudit(
            "RESET_USER_PASSWORD",
            $"重設密碼：UserId={user.UserId}，帳號={user.Account}");

        // 不把新密碼或密碼雜湊寫入紀錄
        await db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "密碼已重設，請使用新密碼重新登入"
        });
    }

    [HttpDelete("{userId:long}")]
    public async Task<IActionResult> DeleteUser(long userId)
    {
        var user = await db.Users
            .Include(item => item.UserRoles)
            .SingleOrDefaultAsync(item => item.UserId == userId);

        if (user == null)
        {
            return NotFound(new { message = "找不到指定的使用者" });
        }

        var hasExecutions = await db.ReportExecutions
            .AnyAsync(item => item.UserId == userId);
        if (hasExecutions)
        {
            return Conflict(new
            {
                message = "此使用者已有報表執行紀錄，為保留稽核資料不可刪除；請先停用帳號。"
            });
        }

        // AuditLogs.UserId is nullable: keep the audit trail after deleting the user.
        var auditLogs = await db.AuditLogs
            .Where(item => item.UserId == userId)
            .ToListAsync();
        foreach (var auditLog in auditLogs)
        {
            auditLog.UserId = null;
        }

        db.UserRoles.RemoveRange(user.UserRoles);
        db.Users.Remove(user);
        AddUserManagementAudit(
            "DELETE_USER",
            $"刪除帳號={user.Account}，UserId={user.UserId}");
        await db.SaveChangesAsync();
        return NoContent();
    }

    // 供本 Controller 的管理操作共用
    private void AddUserManagementAudit(
        string action,
        string details)
    {
        var operatorIdText = HttpContext.Session.GetString(
            "BackOffice.OperatorUserId");

        if (!long.TryParse(operatorIdText, out var operatorId))
        {
            throw new UnauthorizedAccessException(
                "無法取得後台操作者");
        }

        var operatorAccount = HttpContext.Session.GetString(
            "BackOffice.OperatorAccount");

        db.AuditLogs.Add(new AuditLog
        {
            UserId = operatorId,
            Action = action,
            Result = "SUCCESS",
            Details =
                $"透過後台操作；操作者帳號={operatorAccount}；{details}",
            CreatedAt = DateTime.UtcNow
        });
    }
}
