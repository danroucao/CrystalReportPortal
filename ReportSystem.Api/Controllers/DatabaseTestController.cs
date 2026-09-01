using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReportSystem.Api.Data;

namespace ReportSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DatabaseTestController : ControllerBase
{
    private readonly ReportSystemDbContext _dbContext;

    public DatabaseTestController(ReportSystemDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> TestConnection()
    {
        var userCount = await _dbContext.Users.CountAsync();

        return Ok(new
        {
            success = true,
            message = "資料庫連線成功",
            userCount = userCount
        });
    }
}