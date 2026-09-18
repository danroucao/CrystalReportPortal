using CrystalReportPortal.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Authorization;

public sealed class BackOfficeAuthorizationHandler
    : AuthorizationHandler<BackOfficeRequirement>
{
    private readonly AppDbContext _dbContext;
    private readonly IHttpContextAccessor
        _httpContextAccessor;

    public BackOfficeAuthorizationHandler(
        AppDbContext dbContext,
        IHttpContextAccessor httpContextAccessor)
    {
        _dbContext = dbContext;
        _httpContextAccessor = httpContextAccessor;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        BackOfficeRequirement requirement)
    {
        var httpContext =
            _httpContextAccessor.HttpContext;

        if (httpContext == null)
        {
            return;
        }

        var operatorUserIdText =
            httpContext.Session.GetString(
                BackOfficeSessionKeys.OperatorUserId);

        if (!long.TryParse(
                operatorUserIdText,
                out var operatorUserId))
        {
            return;
        }

        var operatorIsEnabled =
            await _dbContext.Users
                .AsNoTracking()
                .AnyAsync(
                    user =>
                        user.UserId == operatorUserId &&
                        user.IsEnabled,
                    httpContext.RequestAborted);

        if (!operatorIsEnabled)
        {
            BackOfficeSessionKeys.ClearAll(
                httpContext.Session);

            return;
        }

        context.Succeed(requirement);
    }
}