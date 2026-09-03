using CrystalReportPortal.Api.Dtos;

namespace CrystalReportPortal.Api.Services;

public interface ICrystalProcessService
{
    Task<CrystalParameterParseResponse> GetParametersAsync(
        string rptPath);
}