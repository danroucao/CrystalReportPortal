using CrystalReportPortal.Api.Dtos;

namespace CrystalReportPortal.Api.Services;

public interface ICrystalProcessService
{
    Task<CrystalParameterParseResponse> GetParametersAsync(
        string rptPath);

    Task<IReadOnlyList<string>> GetHeaderTextsAsync(string rptPath);

    Task CreateLocalizedTemplateAsync(
        string sourceRptPath,
        string outputRptPath,
        IReadOnlyDictionary<string, string> replacements);

    Task<byte[]> PreviewAsync(
        string rptPath);

    Task<CrystalDatabaseTestResponse>
        TestDatabaseConnectionAsync(
            CrystalDatabaseTestRequest request);

    Task<CrystalLovResponse> GetLovOptionsAsync(
        CrystalLovRequest request);
}
