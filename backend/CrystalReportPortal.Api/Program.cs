using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Services;
using CrystalReportPortal.Api.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using System.IO;

var builder = WebApplication.CreateBuilder(args);

// =========================================================
// Database
// =========================================================

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

// =========================================================
// Services
// =========================================================

builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
var keyRingPath = builder.Configuration["DataProtection:KeyRingPath"]
    ?? Path.Combine(builder.Environment.ContentRootPath, "keys");
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(keyRingPath))
    .SetApplicationName("CrystalReportPortal.Api");
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = ".CrystalReportPortal.AntiForgery";
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});
// Session 使用的伺服器端儲存空間
builder.Services.AddDistributedMemoryCache();

// 設定後台 Session
builder.Services.AddSession(options =>
{
    options.Cookie.Name = ".CrystalReportPortal.BackOffice";

    // 不允許前端 JavaScript 直接讀取 Session Cookie
    options.Cookie.HttpOnly = true;

    options.Cookie.IsEssential = true;

    options.Cookie.SameSite = SameSiteMode.Lax;

    // Production back-office sessions must never travel over HTTP. Development
    // keeps its current behavior so the local HTTP Angular server can test it.
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;

    // 30 分鐘沒有使用，Session 就過期
    options.IdleTimeout = TimeSpan.FromMinutes(30);
});
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IBackOfficeAuthService, BackOfficeAuthService>();
builder.Services.AddScoped<IAuthorizationHandler, BackOfficeAuthorizationHandler>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<ICredentialProtector, CredentialProtector>();
builder.Services.AddScoped<ICrystalProcessService, CrystalProcessService>();
builder.Services.AddScoped<ICrystalExportProcessService, CrystalExportProcessService>();
builder.Services.AddScoped<IReportExecutionService, ReportExecutionService>();

// =========================================================
// JWT Authentication
// =========================================================

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("找不到 Jwt:Key");

var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("找不到 Jwt:Issuer");

var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("找不到 Jwt:Audience");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,

                ValidateAudience = true,
                ValidAudience = jwtAudience,

                ValidateLifetime = true,

                ValidateIssuerSigningKey = true,
                IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtKey)),

                ClockSkew = TimeSpan.Zero
            };

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userIdText = context.Principal?
                    .FindFirst(ClaimTypes.NameIdentifier)?
                    .Value;

                var tokenVersionText = context.Principal?
                    .FindFirst("TokenVersion")?
                    .Value;

                if (!long.TryParse(
                        userIdText,
                        out var userId) ||
                    !int.TryParse(
                        tokenVersionText,
                        out var tokenVersion))
                {
                    context.Fail("Token 格式錯誤");
                    return;
                }

                var dbContext =
                    context.HttpContext
                        .RequestServices
                        .GetRequiredService<AppDbContext>();

                var user =
                    await dbContext.Users
                        .AsNoTracking()
                        .SingleOrDefaultAsync(
                            candidate =>
                                candidate.UserId == userId);

                if (user == null ||
                    !user.IsEnabled ||
                    user.TokenVersion != tokenVersion)
                {
                    context.Fail(
                        "Token 已失效或帳號已停用");
                }
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(
        "BackOffice",
        policy =>
        {
            policy.AddRequirements(new BackOfficeRequirement());
        });

    // 前台：註冊功能權限規則
    // 注意：這段在 BackOffice 規則外面
    var permissionCodes = PermissionCodes.All;

    foreach (var permissionCode in permissionCodes)
    {
        options.AddPolicy(permissionCode, policy =>
        {
            policy.RequireAuthenticatedUser();

            policy.RequireClaim(
                "Permission",
                permissionCode);
        });
    }
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:4200",
                "https://localhost:4200",
                "http://localhost:4201",
                "https://localhost:4201")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// =========================================================
// Controllers / OpenAPI
// =========================================================

builder.Services.AddControllers(options =>
    options.Filters.Add<BackOfficeAntiforgeryFilter>());
builder.Services.AddOpenApi();

var app = builder.Build();

// Local development should always include the data migrations used by the
// demo portal. Production deployments keep migration execution explicit.
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.Migrate();
}

// =========================================================
// HTTP Pipeline
// =========================================================

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("Frontend");

app.UseSession();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
