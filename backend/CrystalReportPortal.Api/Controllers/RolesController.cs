using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using CrystalReportPortal.Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/backoffice/roles")]
[Authorize(Policy = "BackOffice")]
public class RolesController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public RolesController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // 查詢所有角色，以及各角色的功能權限
    [HttpGet]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _dbContext.Roles
            .AsNoTracking()
            .OrderBy(role => role.RoleCode)
            .Select(role => new
            {
                role.RoleId,
                role.RoleCode,
                role.RoleName,
                role.Description,
                role.IsEnabled,

                PermissionCodes = role.RolePermissions
                    .Where(item => item.Permission.IsEnabled)
                    .Select(item => item.Permission.PermissionCode)
                    .ToList()
            })
            .ToListAsync();

        return Ok(roles);
    }

    // 新增角色
    [HttpPost]
    public async Task<IActionResult> CreateRole(
        CreateRoleRequest request)
    {
        var roleCode = request.RoleCode.Trim().ToUpperInvariant();
        var roleName = request.RoleName.Trim();

        if (string.IsNullOrWhiteSpace(roleCode) ||
            string.IsNullOrWhiteSpace(roleName))
        {
            return BadRequest(new
            {
                message = "角色代碼與名稱不可空白"
            });
        }

        var exists = await _dbContext.Roles
            .AnyAsync(role => role.RoleCode == roleCode);

        if (exists)
        {
            return Conflict(new
            {
                message = "角色代碼已存在"
            });
        }

        var role = new Role
        {
            RoleCode = roleCode,
            RoleName = roleName,
            Description = request.Description?.Trim(),
            IsEnabled = request.IsEnabled,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Roles.Add(role);

        AddAudit(
            "CREATE_ROLE",
            $"建立角色：{roleCode}，名稱：{roleName}");

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            role.RoleId,
            role.RoleCode,
            role.RoleName,
            role.IsEnabled
        });
    }

    // 修改角色名稱、說明、啟用狀態
    // 角色代碼建立後不在這個 API 修改
    [HttpPut("{roleId:int}")]
    public async Task<IActionResult> UpdateRole(
        int roleId,
        UpdateRoleRequest request)
    {
        var role = await _dbContext.Roles
            .SingleOrDefaultAsync(item => item.RoleId == roleId);

        if (role == null)
        {
            return NotFound(new
            {
                message = "找不到指定的角色"
            });
        }

        if (string.IsNullOrWhiteSpace(request.RoleName))
        {
            return BadRequest(new
            {
                message = "角色名稱不可空白"
            });
        }

        var before =
            $"名稱={role.RoleName}，啟用={role.IsEnabled}，說明={role.Description}";

        role.RoleName = request.RoleName.Trim();
        role.Description = request.Description?.Trim();
        role.IsEnabled = request.IsEnabled;
        role.UpdatedAt = DateTime.UtcNow;

        // 讓使用這個角色的前台舊 Token 失效
        await InvalidateRoleUsersAsync(roleId);

        AddAudit(
            "UPDATE_ROLE",
            $"角色 {role.RoleCode}：[{before}] → " +
            $"[名稱={role.RoleName}，啟用={role.IsEnabled}，說明={role.Description}]");

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            role.RoleId,
            role.RoleCode,
            role.RoleName,
            role.Description,
            role.IsEnabled
        });
    }

    // 查詢可分配的功能權限
    [HttpGet("permissions")]
    public async Task<IActionResult> GetPermissions()
    {
        var permissions = await _dbContext.Permissions
            .AsNoTracking()
            .Where(permission => permission.IsEnabled)
            .OrderBy(permission => permission.PermissionCode)
            .Select(permission => new
            {
                permission.PermissionId,
                permission.PermissionCode,
                permission.PermissionName,
                permission.Description
            })
            .ToListAsync();

        return Ok(permissions);
    }

    // 建立預設功能權限，不會自動授權給任何角色
    // 可重複呼叫：已存在的代碼不會重複新增
    [HttpPost("permissions/initialize")]
    public async Task<IActionResult> InitializePermissions()
    {
        var defaults = new[]
        {
            new
            {
                Code = PermissionCodes.ReportUpload,
                Name = "上傳報表"
            },
            new
            {
                Code = PermissionCodes.ReportMaintain,
                Name = "維護報表"
            },
            new
            {
                Code = PermissionCodes.ReportSetParameters,
                Name = "設定報表參數"
            },
            new
            {
                Code = PermissionCodes.ReportEnableDisable,
                Name = "啟用或停用報表"
            },
            new
            {
                Code = PermissionCodes.DataSourceManage,
                Name = "管理 MSSQL 資料來源"
            },
            new
            {
                Code = PermissionCodes.AuditLogView,
                Name = "查詢操作紀錄"
            }
        };

        var existingCodes = await _dbContext.Permissions
            .Select(permission => permission.PermissionCode)
            .ToListAsync();

        var existingSet = existingCodes.ToHashSet(
            StringComparer.OrdinalIgnoreCase);

        var addedCodes = new List<string>();

        foreach (var item in defaults)
        {
            if (existingSet.Contains(item.Code))
            {
                continue;
            }

            _dbContext.Permissions.Add(new Permission
            {
                PermissionCode = item.Code,
                PermissionName = item.Name,
                IsEnabled = true,
                CreatedAt = DateTime.UtcNow
            });

            addedCodes.Add(item.Code);
        }

        if (addedCodes.Count > 0)
        {
            AddAudit(
                "INITIALIZE_PERMISSIONS",
                $"新增功能權限：{string.Join(", ", addedCodes)}");

            await _dbContext.SaveChangesAsync();
        }

        return Ok(new
        {
            success = true,
            addedCodes
        });
    }

    // 更新指定角色的完整功能權限清單
    // 傳空陣列代表取消該角色的全部功能權限
    [HttpPut("{roleId:int}/permissions")]
    public async Task<IActionResult> UpdatePermissions(
        int roleId,
        UpdateRolePermissionsRequest request)
    {
        var role = await _dbContext.Roles
            .Include(item => item.RolePermissions)
            .ThenInclude(item => item.Permission)
            .SingleOrDefaultAsync(item => item.RoleId == roleId);

        if (role == null)
        {
            return NotFound(new
            {
                message = "找不到指定的角色"
            });
        }

        var requestedCodes = request.PermissionCodes
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var enabledPermissions = await _dbContext.Permissions
            .Where(permission => permission.IsEnabled)
            .ToListAsync();

        var requestedSet = requestedCodes.ToHashSet(
            StringComparer.OrdinalIgnoreCase);

        var selectedPermissions = enabledPermissions
            .Where(permission =>
                requestedSet.Contains(permission.PermissionCode))
            .ToList();

        if (selectedPermissions.Count != requestedCodes.Count)
        {
            return BadRequest(new
            {
                message = "包含不存在或已停用的功能權限"
            });
        }

        var selectedIds = selectedPermissions
            .Select(permission => permission.PermissionId)
            .ToHashSet();

        var existingIds = role.RolePermissions
            .Select(item => item.PermissionId)
            .ToHashSet();

        var toRemove = role.RolePermissions
            .Where(item => !selectedIds.Contains(item.PermissionId))
            .ToList();

        var toAdd = selectedPermissions
            .Where(item => !existingIds.Contains(item.PermissionId))
            .ToList();

        foreach (var item in toRemove)
        {
            AddAudit(
                "UPDATE_ROLE_PERMISSION",
                $"角色={role.RoleCode}，" +
                $"權限={item.Permission.PermissionCode}，由有→無");
        }

        _dbContext.RolePermissions.RemoveRange(toRemove);

        foreach (var permission in toAdd)
        {
            role.RolePermissions.Add(new RolePermission
            {
                RoleId = roleId,
                PermissionId = permission.PermissionId,
                CreatedAt = DateTime.UtcNow
            });

            AddAudit(
                "UPDATE_ROLE_PERMISSION",
                $"角色={role.RoleCode}，" +
                $"權限={permission.PermissionCode}，由無→有");
        }

        if (toRemove.Count > 0 || toAdd.Count > 0)
        {
            role.UpdatedAt = DateTime.UtcNow;

            await InvalidateRoleUsersAsync(roleId);

            await _dbContext.SaveChangesAsync();
        }

        return Ok(new
        {
            success = true,
            role.RoleId,
            role.RoleCode,
            permissionCodes = selectedPermissions
                .Select(item => item.PermissionCode)
                .OrderBy(code => code)
                .ToList()
        });
    }

    [HttpDelete("{roleId:int}")]
    public async Task<IActionResult> DeleteRole(int roleId)
    {
        var role = await _dbContext.Roles
            .Include(item => item.UserRoles)
            .SingleOrDefaultAsync(item => item.RoleId == roleId);

        if (role == null)
        {
            return NotFound(new { message = "找不到指定的角色" });
        }

        if (role.UserRoles.Count > 0)
        {
            return Conflict(new { message = "此角色仍有使用者使用，請先移除使用者角色。" });
        }

        _dbContext.Roles.Remove(role);
        AddAudit("DELETE_ROLE", $"刪除角色：{role.RoleCode}");
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    private async Task InvalidateRoleUsersAsync(int roleId)
    {
        var users = await _dbContext.Users
            .Where(user =>
                user.UserRoles.Any(item => item.RoleId == roleId))
            .ToListAsync();

        foreach (var user in users)
        {
            user.TokenVersion += 1;
        }
    }

    private void AddAudit(string action, string details)
    {
        var operatorIdText = HttpContext.Session.GetString(
            "BackOffice.OperatorUserId");

        if (!long.TryParse(operatorIdText, out var operatorId))
        {
            throw new UnauthorizedAccessException(
                "無法取得後台操作者");
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = operatorId,
            Action = action,
            Result = "SUCCESS",
            Details = $"透過後台操作；{details}",
            CreatedAt = DateTime.UtcNow
        });
    }
}