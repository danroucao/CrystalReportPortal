using System.Text.Json;
using System.Globalization;
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

        // A report without an assigned data source is intentionally rendered from
        // the Saved Data embedded in its RPT. It must not try to resolve database
        // credentials or accept runtime query parameters.
        if (report.DataSource == null)
        {
            return await ExecuteSavedDataAsync(report, userId, request);
        }

        if (report.DataSource == null || !report.DataSource.IsEnabled || !File.Exists(report.RptFilePath))
        {
            throw new InvalidOperationException("報表 RPT 或資料來源不存在、未啟用。");
        }

        var supplied = (request.Parameters ?? [])
            .GroupBy(x => x.ParameterId)
            .ToDictionary(x => x.Key, x => x.Last().Values.Where(v => !string.IsNullOrWhiteSpace(v)).ToList());
        var reportParameters = report.ReportParameters.ToDictionary(x => x.ParameterId);
        if (supplied.Keys.Any(id => !reportParameters.ContainsKey(id))) throw new ArgumentException("An unknown report parameter was supplied.");
        var employeeNo = await db.Users.Where(x => x.UserId == userId).Select(x => x.EmployeeNo).SingleAsync();

        var exportParameters = new List<CrystalExportProcessParameter>();
        foreach (var parameter in report.ReportParameters)
        {
            var values = supplied.GetValueOrDefault(parameter.ParameterId) ?? [];
            if (string.Equals(parameter.ValueSourceType, "CurrentUser", StringComparison.OrdinalIgnoreCase)) values = [employeeNo];
            if (!parameter.IsVisible && supplied.ContainsKey(parameter.ParameterId) &&
                !string.Equals(parameter.ValueSourceType, "CurrentUser", StringComparison.OrdinalIgnoreCase))
            {
                throw new ArgumentException($"Parameter '{parameter.DisplayName}' is not user-editable.");
            }
            if (parameter.IsRequired && values.Count == 0) throw new ArgumentException($"Parameter '{parameter.DisplayName}' is required.");
            if (!parameter.AllowMultipleValues && values.Count > 1) throw new ArgumentException($"Parameter '{parameter.DisplayName}' accepts only one value.");
            ValidateParameterValues(parameter, values);
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
                        RptPath = GetExecutableRptPath(report.RptFilePath),

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
                        ,HeaderTextReplacements = GetHeaderTextReplacements(report)
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

    private async Task<(Guid ExecutionId, byte[] Pdf)> ExecuteSavedDataAsync(
        Report report,
        long userId,
        ReportExecutionRequest request)
    {
        if (string.IsNullOrWhiteSpace(report.RptFilePath) || !File.Exists(report.RptFilePath))
        {
            throw new InvalidOperationException("The report RPT file is not available.");
        }

        var execution = new ReportExecution
        {
            ExecutionId = Guid.NewGuid(),
            ReportId = report.ReportId,
            UserId = userId,
            ParametersJson = JsonSerializer.Serialize(request.Parameters ?? []),
            Status = "Running",
            StartedAt = DateTime.UtcNow
        };

        db.ReportExecutions.Add(execution);
        await db.SaveChangesAsync();

        try
        {
            var pdf = await crystal.ExportPdfAsync(new CrystalExportProcessRequest
            {
                RptPath = GetExecutableRptPath(report.RptFilePath),
                UseSavedDataOnly = true,
                Parameters = [],
                HeaderTextReplacements = GetHeaderTextReplacements(report)
            });

            execution.Status = "Completed";
            execution.CompletedAt = DateTime.UtcNow;
            db.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                ReportId = report.ReportId,
                ExecutionId = execution.ExecutionId,
                Action = ExecuteReportAction,
                Result = "SUCCESS",
                Details = $"Executed Saved Data report {report.ReportCode} and generated PDF.",
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();

            return (execution.ExecutionId, pdf);
        }
        catch (Exception exception)
        {
            execution.Status = "Failed";
            execution.ErrorMessage = exception.Message;
            execution.CompletedAt = DateTime.UtcNow;
            db.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                ReportId = report.ReportId,
                ExecutionId = execution.ExecutionId,
                Action = ExecuteReportAction,
                Result = "FAILED",
                Details = $"Saved Data execution for report {report.ReportCode} failed.",
                ErrorMessage = exception.Message,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            throw;
        }
    }

    private static Dictionary<string, string> GetHeaderTextReplacements(Report report)
    {
        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    }

    private static string GetExecutableRptPath(string sourceRptPath)
    {
        return sourceRptPath;
    }

    private static void ValidateParameterValues(ReportParameter parameter, List<string> values)
    {
        foreach (var value in values)
        {
            if (string.Equals(parameter.DataType, "Number", StringComparison.OrdinalIgnoreCase) &&
                !decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out _))
                throw new ArgumentException($"Parameter '{parameter.DisplayName}' contains an invalid number.");
            if ((string.Equals(parameter.DataType, "Date", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(parameter.DataType, "DateTime", StringComparison.OrdinalIgnoreCase)) &&
                !DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
                throw new ArgumentException($"Parameter '{parameter.DisplayName}' contains an invalid date.");
            if (string.Equals(parameter.DataType, "Boolean", StringComparison.OrdinalIgnoreCase) &&
                !bool.TryParse(value, out _))
                throw new ArgumentException($"Parameter '{parameter.DisplayName}' contains an invalid boolean value.");
        }

        if (parameter.AllowRangeValues && values.Count == 2 &&
            DateTime.TryParse(values[0], CultureInfo.InvariantCulture, out var start) &&
            DateTime.TryParse(values[1], CultureInfo.InvariantCulture, out var end) && start > end)
            throw new ArgumentException($"Parameter '{parameter.DisplayName}' has an invalid range.");
    }
}
