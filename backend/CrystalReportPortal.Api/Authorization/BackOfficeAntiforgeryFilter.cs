using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CrystalReportPortal.Api.Authorization;

/// <summary>Requires an anti-forgery token for unsafe back-office requests.</summary>
public sealed class BackOfficeAntiforgeryFilter : IAsyncAuthorizationFilter
{
    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Get, HttpMethods.Head, HttpMethods.Options, HttpMethods.Trace
    };

    private readonly IAntiforgery antiforgery;
    public BackOfficeAntiforgeryFilter(IAntiforgery antiforgery) => this.antiforgery = antiforgery;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var request = context.HttpContext.Request;
        if (SafeMethods.Contains(request.Method)) return;

        var requiresBackOfficeSession = context.HttpContext.GetEndpoint()?
            .Metadata
            .GetOrderedMetadata<IAuthorizeData>()
            .Any(authorizeData => string.Equals(
                authorizeData.Policy,
                "BackOffice",
                StringComparison.Ordinal)) == true;

        if (!requiresBackOfficeSession) return;

        // These endpoints establish the server session required before a token can be issued.
        if (request.Path.Equals("/api/backoffice-auth/login") || request.Path.Equals("/api/backoffice-auth/verify-operator")) return;

        try { await antiforgery.ValidateRequestAsync(context.HttpContext); }
        catch (AntiforgeryValidationException)
        {
            context.Result = new BadRequestObjectResult(new { message = "後台操作驗證已失效，請重新確認操作者身分。" });
        }
    }
}
