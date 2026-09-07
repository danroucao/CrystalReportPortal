using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/crystal-preview")]
[Authorize(Roles = "ADMIN")]
public class CrystalPreviewController : ControllerBase
{
    private readonly ICrystalProcessService
        _crystalProcessService;

    public CrystalPreviewController(
        ICrystalProcessService crystalProcessService)
    {
        _crystalProcessService =
            crystalProcessService;
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Preview(
        IFormFile file)
    {
        if (file == null ||
            file.Length == 0)
        {
            return BadRequest(new
            {
                success = false,
                message = "請選擇 RPT 檔案。"
            });
        }

        var extension =
            Path.GetExtension(file.FileName);

        if (!string.Equals(
                extension,
                ".rpt",
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                success = false,
                message = "只允許上傳 .rpt 檔案。"
            });
        }

        var tempDirectory =
            Path.Combine(
                Path.GetTempPath(),
                "CrystalReportPortal",
                "Uploads");

        Directory.CreateDirectory(
            tempDirectory);

        var tempRptPath =
            Path.Combine(
                tempDirectory,
                $"{Guid.NewGuid():N}.rpt");

        try
        {
            await using (
                var stream =
                    System.IO.File.Create(
                        tempRptPath))
            {
                await file.CopyToAsync(
                    stream);
            }

            var pdfBytes =
                await _crystalProcessService
                    .PreviewAsync(
                        tempRptPath);

            var outputFileName =
                Path.GetFileNameWithoutExtension(
                    file.FileName)
                + ".pdf";

            return File(
                pdfBytes,
                "application/pdf",
                outputFileName);
        }
        catch (Exception ex)
        {
            return StatusCode(
                StatusCodes
                    .Status500InternalServerError,
                new
                {
                    success = false,
                    message =
                        "Crystal Report 轉換 PDF 失敗。",
                    detail =
                        ex.Message
                });
        }
        finally
        {
            if (System.IO.File.Exists(
                    tempRptPath))
            {
                try
                {
                    System.IO.File.Delete(
                        tempRptPath);
                }
                catch
                {
                }
            }
        }
    }
}