using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;

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

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<ICredentialProtector, CredentialProtector>();
builder.Services.AddScoped<ICrystalProcessService, CrystalProcessService>();

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

builder.Services.AddAuthorization();

builder.Services.AddCors(options => { options.AddPolicy("Frontend", policy => policy.WithOrigins("http://localhost:4200", "https://localhost:4200").AllowAnyHeader().AllowAnyMethod()); });

// =========================================================
// Controllers / OpenAPI
// =========================================================

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// =========================================================
// HTTP Pipeline
// =========================================================

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();