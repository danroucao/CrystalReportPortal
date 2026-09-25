using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using CrystalReportPortal.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Threading.Tasks;
using System;
using System.Collections.Generic;
using Xunit;

namespace CrystalReportPortal.Api.Tests;

public class AuthServiceIntegrationTests
{
    [Fact]
    public async Task DevelopmentBackOfficeSharedCredentials_CanLogIn()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new AppDbContext(options);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BackOffice:Account"] = "admin",
                ["BackOffice:PasswordHash"] = "$2a$11$oPDXdvAtuZnmmTFWMM/RQO5sSoDsl5XQy0c6gOPRgOgBN1rtGjavC"
            })
            .Build();

        var result = await new BackOfficeAuthService(db, configuration)
            .LoginAsync(new BackOfficeLoginRequest
            {
                Account = "admin",
                Password = "admin"
            });

        Assert.True(result.Success);
    }

    [Theory]
    [InlineData(
        "user@example.com",
        "user123",
        "$2a$11$rAdoYTVSALtf5TQ59yji6em4bfC7eCWRGkiwpH6iEVG/pD4niW6MG",
        "DEV_FRONT_USER")]
    [InlineData(
        "admin@example.com",
        "Test1234",
        "$2a$11$YqylCUoTeirX/2YbK29xCe1Bc82gGWLr.hWgo5vpMOjXlYm6n/DGi",
        "DEV_SYSTEM_ADMIN")]
    public async Task DevelopmentSeedCredentials_CanLogIn(
        string account,
        string password,
        string passwordHash,
        string roleCode)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new AppDbContext(options);
        var role = new Role
        {
            RoleId = 1,
            RoleCode = roleCode,
            RoleName = "Development test role",
            IsEnabled = true,
            CreatedAt = DateTime.UtcNow
        };
        var user = new User
        {
            UserId = 1,
            EmployeeNo = "DEVTEST001",
            Account = account,
            UserName = "Development test user",
            PasswordHash = passwordHash,
            IsEnabled = true,
            TokenVersion = 0,
            CreatedAt = DateTime.UtcNow
        };
        db.AddRange(role, user, new UserRole
        {
            UserId = user.UserId,
            RoleId = role.RoleId,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "test",
                ["Jwt:Audience"] = "test",
                ["Jwt:Key"] = "test-key-test-key-test-key-test-key",
                ["Jwt:ExpireMinutes"] = "60"
            })
            .Build();

        var result = await new AuthService(db, configuration).LoginAsync(new LoginRequest
        {
            Account = account,
            Password = password
        });

        Assert.True(result.Success);
        Assert.NotNull(result.User);
        Assert.Equal(account, result.User!.Account);
        Assert.Contains(roleCode, result.User.Roles);
    }

    [Fact]
    public async Task ChangePassword_UsesAuthenticatedUserId_AndInvalidatesToken()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new AppDbContext(options);
        var user = new User
        {
            UserId = 7,
            EmployeeNo = "TEST001",
            Account = "user@example.com",
            UserName = "測試使用者",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("OldPass123"),
            IsEnabled = true,
            TokenVersion = 4,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "test",
                ["Jwt:Audience"] = "test",
                ["Jwt:Key"] = "test-key-test-key-test-key-test-key"
            })
            .Build();
        var service = new AuthService(db, configuration);

        var result = await service.ChangePasswordAsync(
            new ChangePasswordRequest
            {
                CurrentPassword = "OldPass123",
                NewPassword = "NewPass456"
            },
            user.UserId);

        Assert.True(result.Success);
        Assert.Equal(5, user.TokenVersion);
        Assert.True(BCrypt.Net.BCrypt.Verify("NewPass456", user.PasswordHash));
        Assert.Contains(db.AuditLogs, log => log.Action == "CHANGE_PASSWORD" && log.Result == "SUCCESS");
    }

    [Fact]
    public async Task ChangePassword_RejectsWrongCurrentPassword()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new AppDbContext(options);
        var user = new User
        {
            UserId = 8,
            EmployeeNo = "TEST002",
            Account = "other@example.com",
            UserName = "測試使用者",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("OldPass123"),
            IsEnabled = true,
            TokenVersion = 1,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var service = new AuthService(db, new ConfigurationBuilder().Build());

        var result = await service.ChangePasswordAsync(
            new ChangePasswordRequest
            {
                CurrentPassword = "WrongPass123",
                NewPassword = "NewPass456"
            },
            user.UserId);

        Assert.False(result.Success);
        Assert.Equal(1, user.TokenVersion);
    }
}
