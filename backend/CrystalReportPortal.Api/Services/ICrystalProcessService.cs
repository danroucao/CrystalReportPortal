using CrystalReportPortal.Api.Dtos;

namespace CrystalReportPortal.Api.Services;

public interface ICrystalProcessService
{
    Task<CrystalParameterParseResponse> GetParametersAsync(
        string rptPath);

    Task<byte[]> PreviewAsync(
        string rptPath);

    Task<CrystalDatabaseTestResponse>
        TestDatabaseConnectionAsync(
            CrystalDatabaseTestRequest request);

    Task<CrystalLovResponse> GetLovOptionsAsync(
        CrystalLovRequest request);
}