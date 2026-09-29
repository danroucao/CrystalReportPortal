using System.Security.Claims;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/report-previews")]
[Authorize]
public sealed class ReportPreviewImagesController(IReportPreviewImageService previews) : ControllerBase
{
    [HttpGet("{previewId:guid}/pages/{pageNumber:int}")]
    public IActionResult GetPage(Guid previewId, int pageNumber)
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized();
        return previews.TryGetPage(previewId, userId, pageNumber, out var pagePath)
            ? File(System.IO.File.OpenRead(pagePath), "image/png")
            : NotFound();
    }
}
