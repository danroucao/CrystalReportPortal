using CrystalReportPortal.Api.Authorization;
using CrystalReportPortal.Api.Controllers;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Xunit;

namespace CrystalReportPortal.Api.Tests;

public class AuditLogsControllerTests
{
    [Fact]
    public async Task GetAuditLogs_HidesArchiveRecordsWithoutArchivePermission()
    {
        await using var db = CreateDbContext();
        var now = DateTime.UtcNow;
        db.AuditLogs.AddRange(
            CreateAuditLog(1, now.AddDays(-181)),
            CreateAuditLog(2, now.AddDays(-179)));
        await db.SaveChangesAsync();

        var controller = CreateController(db, canViewArchive: false);
        var result = await controller.GetAuditLogs(new AuditLogQueryRequest());

        var response = GetResponse(result);
        Assert.Equal(1, response.TotalCount);
        Assert.Equal(2, response.Items.Single().AuditLogId);
    }

    [Fact]
    public async Task GetAuditLogs_ForbidsExplicitArchiveQueryWithoutArchivePermission()
    {
        await using var db = CreateDbContext();
        var controller = CreateController(db, canViewArchive: false);

        var result = await controller.GetAuditLogs(new AuditLogQueryRequest
        {
            FromUtc = DateTime.UtcNow.AddDays(-181)
        });

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetAuditLogs_IncludesArchiveRecordsWithArchivePermission()
    {
        await using var db = CreateDbContext();
        var now = DateTime.UtcNow;
        db.AuditLogs.AddRange(
            CreateAuditLog(1, now.AddDays(-181)),
            CreateAuditLog(2, now.AddDays(-179)));
        await db.SaveChangesAsync();

        var controller = CreateController(db, canViewArchive: true);
        var result = await controller.GetAuditLogs(new AuditLogQueryRequest());

        Assert.Equal(2, GetResponse(result).TotalCount);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static AuditLogsController CreateController(
        AppDbContext db,
        bool canViewArchive)
    {
        var claims = new List<Claim>
        {
            new("Permission", PermissionCodes.AuditLogView)
        };
        if (canViewArchive)
        {
            claims.Add(
                new Claim(
                    "Permission",
                    PermissionCodes.AuditLogViewArchive));
        }

        return new AuditLogsController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(
                        new ClaimsIdentity(claims, "test"))
                }
            }
        };
    }

    private static AuditLog CreateAuditLog(
        long id,
        DateTime createdAt) => new()
        {
            AuditLogId = id,
            Action = "TEST",
            Result = "SUCCESS",
            CreatedAt = createdAt
        };

    private static AuditLogListResponse GetResponse(
        ActionResult<AuditLogListResponse> result)
    {
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        return Assert.IsType<AuditLogListResponse>(ok.Value);
    }
}
