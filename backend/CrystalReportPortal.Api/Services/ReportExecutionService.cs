using System.Text.Json;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Services;

public class ReportExecutionService : IReportExecutionService
{
    private const string ExecuteReportAction = "EXECUTE_REPORT";

    private readonly AppDbContext db;
    private readonly IReportService reports;
    private readonly ICredentialProtector credentials;
    private readonly ICrystalExportProcessService crystal;

    public ReportExecutionService(AppDbContext db, IReportService reports, ICredentialProtector credentials, ICrystalExportProcessService crystal)
        => (this.db, this.reports, this.credentials, this.crystal) = (db, reports, credentials, crystal);

    public async Task<(Guid ExecutionId, byte[] Pdf)> ExecuteAsync(long reportId, long userId, List<string> roleCodes, ReportExecutionRequest request)
    {
        if (!await reports.CanExecuteReportAsync(reportId, roleCodes)) throw new UnauthorizedAccessException("You do not have permission to execute this report.");

        var report = await db.Reports.Include(x => x.DataSource).ThenInclude(x => x.Credentials)
            .Include(x => x.ReportParameters).FirstOrDefaultAsync(x => x.ReportId == reportId)
            ?? throw new KeyNotFoundException("Report was not found.");
        if (!report.DataSource.IsEnabled || !File.Exists(report.RptFilePath)) throw new InvalidOperationException("The report or its data source is unavailable.");

        var supplied = request.Parameters.GroupBy(x => x.ParameterId).ToDictionary(x => x.Key, x => x.Last().Values.Where(v => !string.IsNullOrWhiteSpace(v)).ToList());
        var reportParameters = report.ReportParameters.ToDictionary(x => x.ParameterId);
        if (supplied.Keys.Any(id => !reportParameters.ContainsKey(id))) throw new ArgumentException("An unknown report parameter was supplied.");
        var employeeNo = await db.Users.Where(x => x.UserId == userId).Select(x => x.EmployeeNo).SingleAsync();

        var exportParameters = new List<CrystalExportProcessParameter>();
        foreach (var parameter in report.ReportParameters)
        {
            var values = supplied.GetValueOrDefault(parameter.ParameterId) ?? [];
            if (string.Equals(parameter.ValueSourceType, "CurrentUser", StringComparison.OrdinalIgnoreCase)) values = [employeeNo];
            if (parameter.IsRequired && values.Count == 0) throw new ArgumentException($"Parameter '{parameter.DisplayName}' is required.");
            if (values.Count > 0) exportParameters.Add(new CrystalExportProcessParameter { Name = parameter.ParameterName, DataType = parameter.DataType, Values = values });
        }

        var credential =
            report.DataSource.Credentials
                .FirstOrDefault(x =>
                    string.Equals(
                        x.CredentialType,
                        report.CredentialType,
                        StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException(
                $"資料來源尚未設定 {report.CredentialType} 憑證。");

        var integratedSecurity =
            string.Equals(
                credential.AuthenticationType,
                "Windows",
                StringComparison.OrdinalIgnoreCase);

        string username;
        string password;

        if (integratedSecurity)
        {
            username = string.Empty;
            password = string.Empty;
        }
        else if (string.Equals(
                     credential.AuthenticationType,
                     "SqlServer",
                     StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(credential.Username))
            {
                throw new InvalidOperationException(
                    "SQL Server Authentication 缺少資料庫帳號。");
            }

            if (string.IsNullOrWhiteSpace(
                    credential.EncryptedPassword))
            {
                throw new InvalidOperationException(
                    "SQL Server Authentication 缺少資料庫密碼。");
            }

            username = credential.Username;
            password = credentials.Unprotect(
                credential.EncryptedPassword);
        }
        else
        {
            throw new InvalidOperationException(
                $"不支援的資料庫驗證方式：{credential.AuthenticationType}");
        }

        var execution = new ReportExecution
        {
            ExecutionId = Guid.NewGuid(),
            ReportId = reportId,
            UserId = userId,
            ParametersJson =
                JsonSerializer.Serialize(request.Parameters),
            Status = "Running",
            StartedAt = DateTime.UtcNow
        };

        db.ReportExecutions.Add(execution);
        await db.SaveChangesAsync();

        try
        {
            var pdf =
                await crystal.ExportPdfAsync(
                    new CrystalExportProcessRequest
                    {
                        RptPath = report.RptFilePath,

                        Database = new CrystalExportDatabase
                        {
                            Server =
                                $"{report.DataSource.ServerHost}," +
                                $"{report.DataSource.Port}",

                            Database =
                                report.DataSource.DatabaseName,

                            IntegratedSecurity =
                                integratedSecurity,

                            Username =
                                username,

                            Password =
                                password
                        },

                        Parameters = exportParameters
                    });

            execution.Status = "Completed";
            execution.CompletedAt = DateTime.UtcNow;

            db.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                ReportId = reportId,
                ExecutionId = execution.ExecutionId,
                Action = ExecuteReportAction,
                Result = "SUCCESS",
                Details =
                    $"成功執行報表 {report.ReportCode} 並產生 PDF。",
                CreatedAt = DateTime.UtcNow
            });

            await db.SaveChangesAsync();

            return (execution.ExecutionId, pdf);
        }
        catch (Exception ex)
        {
            execution.Status = "Failed";
            execution.ErrorMessage = ex.Message;
            execution.CompletedAt = DateTime.UtcNow;

            db.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                ReportId = reportId,
                ExecutionId = execution.ExecutionId,
                Action = ExecuteReportAction,
                Result = "FAILED",
                Details = $"執行報表 {report.ReportCode} 失敗。",
                ErrorMessage = ex.Message,
                CreatedAt = DateTime.UtcNow
            });

            await db.SaveChangesAsync();

            throw;
        }
    }
}
