using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "ADMIN")]
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
}
