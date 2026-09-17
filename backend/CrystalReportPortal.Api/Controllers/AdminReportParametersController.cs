using System.Security.Claims;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/backoffice/reports/{reportId:long}/parameters")]
[Authorize(Policy = "Report.SetParameters")]
public class AdminReportParametersController : ControllerBase
{
    private static readonly HashSet<string> AllowedDataTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "String", "Date", "DateTime", "Number", "Boolean"
        };

    private static readonly HashSet<string> AllowedInputTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "Text", "DatePicker", "Select", "MultiSelect", "Hidden", "Number", "Checkbox"
        };

    private static readonly HashSet<string> AllowedValueSourceTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "UserInput", "SqlLov", "CurrentUser"
        };

    private static readonly string[] ForbiddenSqlFragments =
    {
        ";", "--", "/*", "*/", " insert ", " update ", " delete ",
        " merge ", " into ", " drop ", " alter ", " create ", " truncate ",
        " exec ", " execute ", " grant ", " revoke "
    };

    private readonly AppDbContext _dbContext;

    public AdminReportParametersController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<AdminReportParametersResponse>> GetParameters(long reportId)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var accessResult = await CheckReportAccessAsync(reportId, userId);
        if (accessResult != null)
        {
            return accessResult;
        }

        var report = await LoadReportAsync(reportId);
        if (report == null)
        {
            return NotFound(new { message = "找不到指定的報表。" });
        }

        return Ok(ToResponse(report));
    }

    [HttpPut("{parameterId:long}")]
    public async Task<ActionResult<AdminReportParameterDto>> UpdateParameter(
        long reportId,
        long parameterId,
        UpdateAdminReportParameterRequest request)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var accessResult = await CheckReportAccessAsync(reportId, userId);
        if (accessResult != null)
        {
            return accessResult;
        }

        var parameter = await _dbContext.ReportParameters
            .Include(candidate => candidate.Report)
            .Include(candidate => candidate.LovConfig)
            .Include(candidate => candidate.CommonTemplate)
            .SingleOrDefaultAsync(candidate =>
                candidate.ReportId == reportId &&
                candidate.ParameterId == parameterId);

        if (parameter == null)
        {
            return NotFound(new { message = "找不到指定的報表參數。" });
        }

        var now = DateTime.UtcNow;

        if (request.CommonTemplateId.HasValue)
        {
            if (request.AddToCommonTemplates)
            {
                return BadRequest(new { message = "套用既有模板時不可同時建立新模板。" });
            }

            var template = await _dbContext.CommonParameterTemplates
                .SingleOrDefaultAsync(candidate =>
                    candidate.TemplateId == request.CommonTemplateId.Value &&
                    candidate.IsEnabled);

            if (template == null)
            {
                return BadRequest(new { message = "指定的常用參數不存在或已停用。" });
            }

            if (!TemplateMatchesParameter(template, parameter))
            {
                return BadRequest(new { message = "常用參數的資料型別、多值或範圍設定與 RPT 參數不相容。" });
            }

            if (!TryValidateTemplate(template, out var templateError))
            {
                return BadRequest(new { message = templateError });
            }

            ApplyTemplate(parameter, template, now);
        }
        else
        {
            var validationResult = await ValidateManualRequestAsync(parameter, request);
            if (validationResult != null)
            {
                return validationResult;
            }

            ApplyManualConfiguration(parameter, request, now);

            if (request.AddToCommonTemplates)
            {
                var createTemplateResult = await CreateTemplateAsync(parameter, request, userId, now);
                if (createTemplateResult.Error != null)
                {
                    return createTemplateResult.Error;
                }

                parameter.CommonTemplate = createTemplateResult.Template;

                AddAuditLog(
                    userId,
                    reportId,
                    "CREATE_COMMON_PARAMETER_TEMPLATE",
                    $"由報表參數建立常用模板 {createTemplateResult.Template!.TemplateCode}",
                    now);
            }
        }

        parameter.IsConfigured = true;
        parameter.UpdatedAt = now;

        // 參數有任何異動，都必須重新完成設定並再次啟用報表。
        parameter.Report.ConfigurationStatus = "Draft";
        parameter.Report.IsEnabled = false;
        parameter.Report.UpdatedBy = userId;
        parameter.Report.UpdatedAt = now;

        AddAuditLog(
            userId,
            reportId,
            "UPDATE_REPORT_PARAMETER",
            $"已設定參數 {parameter.ParameterName}",
            now);

        await _dbContext.SaveChangesAsync();

        var updated = await _dbContext.ReportParameters
            .AsNoTracking()
            .Include(candidate => candidate.CommonTemplate)
            .Include(candidate => candidate.LovConfig)
            .SingleAsync(candidate => candidate.ParameterId == parameterId);

        return Ok(ToDto(updated));
    }

    [HttpPost("complete")]
    public async Task<ActionResult<CompleteReportParameterConfigurationResponse>> Complete(
        long reportId)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var accessResult = await CheckReportAccessAsync(reportId, userId);
        if (accessResult != null)
        {
            return accessResult;
        }

        var report = await _dbContext.Reports
            .Include(candidate => candidate.ReportParameters)
                .ThenInclude(parameter => parameter.LovConfig)
            .SingleOrDefaultAsync(candidate => candidate.ReportId == reportId);

        if (report == null)
        {
            return NotFound(new { message = "找不到指定的報表。" });
        }

        if (string.IsNullOrWhiteSpace(report.RptFilePath))
        {
            return BadRequest(new { message = "報表尚未上傳 RPT 檔案。" });
        }

        var incompleteParameters = report.ReportParameters
            .Where(parameter =>
                !parameter.IsConfigured ||
                (string.Equals(parameter.ValueSourceType, "SqlLov", StringComparison.OrdinalIgnoreCase) &&
                 parameter.LovConfig == null))
            .Select(parameter => new
            {
                parameter.ParameterId,
                parameter.ParameterName
            })
            .ToList();

        if (incompleteParameters.Count > 0)
        {
            return BadRequest(new
            {
                message = "仍有尚未完成設定的參數。",
                parameters = incompleteParameters
            });
        }

        var now = DateTime.UtcNow;
        report.ConfigurationStatus = "PendingReview";
        report.IsEnabled = false;
        report.UpdatedBy = userId;
        report.UpdatedAt = now;

        AddAuditLog(
            userId,
            reportId,
            "COMPLETE_REPORT_PARAMETER_CONFIGURATION",
            "報表參數設定完成，等待測試預覽與確認",
            now);

        await _dbContext.SaveChangesAsync();

        return Ok(new CompleteReportParameterConfigurationResponse
        {
            Success = true,
            ReportId = reportId,
            ConfigurationStatus = report.ConfigurationStatus,
            IsEnabled = report.IsEnabled,
            Message = "參數設定已完成；請執行測試預覽並確認報表版面。"
        });
    }

    private async Task<Report?> LoadReportAsync(long reportId)
    {
        return await _dbContext.Reports
            .AsNoTracking()
            .Include(report => report.ReportParameters)
                .ThenInclude(parameter => parameter.CommonTemplate)
            .Include(report => report.ReportParameters)
                .ThenInclude(parameter => parameter.LovConfig)
            .SingleOrDefaultAsync(report => report.ReportId == reportId);
    }

    private async Task<ActionResult?> CheckReportAccessAsync(long reportId, long userId)
    {
        var reportExists = await _dbContext.Reports
            .AsNoTracking()
            .AnyAsync(report => report.ReportId == reportId);

        if (!reportExists)
        {
            return NotFound(new { message = "找不到指定的報表。" });
        }

        var permitted = await _dbContext.UserRoles
            .AsNoTracking()
            .AnyAsync(userRole =>
                userRole.UserId == userId &&
                userRole.Role.IsEnabled &&
                userRole.Role.RoleReportPermissions.Any(permission =>
                    permission.ReportId == reportId &&
                    permission.CanSetParameters));

        return permitted ? null : Forbid();
    }

    private async Task<ActionResult?> ValidateManualRequestAsync(
        ReportParameter parameter,
        UpdateAdminReportParameterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DisplayName) ||
            string.IsNullOrWhiteSpace(request.DataType) ||
            string.IsNullOrWhiteSpace(request.InputType) ||
            string.IsNullOrWhiteSpace(request.ValueSourceType))
        {
            return BadRequest(new { message = "顯示名稱、資料型別、輸入型態及值來源不可空白。" });
        }

        if (!AllowedDataTypes.Contains(request.DataType) ||
            !AllowedInputTypes.Contains(request.InputType) ||
            !AllowedValueSourceTypes.Contains(request.ValueSourceType))
        {
            return BadRequest(new { message = "DataType、InputType 或 ValueSourceType 不在允許範圍內。" });
        }

        if (!string.Equals(request.DataType, parameter.DataType, StringComparison.OrdinalIgnoreCase) ||
            request.AllowMultipleValues != parameter.AllowMultipleValues ||
            request.AllowRangeValues != parameter.AllowRangeValues)
        {
            return BadRequest(new
            {
                message = "資料型別、多值及範圍能力來自 RPT，不可在參數設定中變更。"
            });
        }

        if (request.AllowMultipleValues && request.AllowRangeValues)
        {
            return BadRequest(new { message = "參數不可同時設定為多值與範圍值。" });
        }

        if (string.Equals(request.InputType, "MultiSelect", StringComparison.OrdinalIgnoreCase) !=
            request.AllowMultipleValues)
        {
            return BadRequest(new { message = "MultiSelect 必須搭配 RPT 多值參數。" });
        }

        if (string.Equals(request.ValueSourceType, "CurrentUser", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.InputType, "Hidden", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "CurrentUser 參數必須使用 Hidden 輸入型態。" });
        }

        if (request.DataSourceId.HasValue &&
            !await _dbContext.ReportDataSources.AnyAsync(source =>
                source.DataSourceId == request.DataSourceId.Value && source.IsEnabled))
        {
            return BadRequest(new { message = "指定的資料來源不存在或未啟用。" });
        }

        if (string.Equals(request.ValueSourceType, "SqlLov", StringComparison.OrdinalIgnoreCase))
        {
            if (!request.DataSourceId.HasValue ||
                string.IsNullOrWhiteSpace(request.SqlQuery) ||
                string.IsNullOrWhiteSpace(request.ValueField) ||
                string.IsNullOrWhiteSpace(request.DisplayField))
            {
                return BadRequest(new { message = "SQL LOV 必須設定資料來源、查詢、值欄位與顯示欄位。" });
            }

            if (!IsReadOnlySelect(request.SqlQuery))
            {
                return BadRequest(new { message = "SQL LOV 僅允許單一 SELECT 查詢。" });
            }
        }

        if (request.AddToCommonTemplates &&
            (string.IsNullOrWhiteSpace(request.NewTemplateCode) ||
             string.IsNullOrWhiteSpace(request.NewTemplateName)))
        {
            return BadRequest(new { message = "加入常用參數時必須填寫模板代碼及模板名稱。" });
        }

        return null;
    }

    private async Task<(CommonParameterTemplate? Template, ActionResult? Error)> CreateTemplateAsync(
        ReportParameter parameter,
        UpdateAdminReportParameterRequest request,
        long userId,
        DateTime now)
    {
        var templateCode = request.NewTemplateCode!.Trim();
        if (await _dbContext.CommonParameterTemplates.AnyAsync(template =>
                template.TemplateCode == templateCode))
        {
            return (null, Conflict(new { message = "常用參數代碼已存在。" }));
        }

        var normalizedName = NormalizeParameterName(parameter.ParameterName);
        var duplicateRule = await _dbContext.CommonParameterTemplates.AnyAsync(template =>
            template.IsEnabled &&
            template.NormalizedParameterName == normalizedName &&
            template.DataType == parameter.DataType &&
            template.AllowMultipleValues == parameter.AllowMultipleValues &&
            template.AllowRangeValues == parameter.AllowRangeValues &&
            template.DataSourceId == request.DataSourceId);

        if (duplicateRule)
        {
            return (null, Conflict(new
            {
                message = "已有相同匹配條件的啟用模板，請直接套用既有模板。"
            }));
        }

        var template = new CommonParameterTemplate
        {
            TemplateCode = templateCode,
            TemplateName = request.NewTemplateName!.Trim(),
            NormalizedParameterName = normalizedName,
            DataType = parameter.DataType,
            InputType = parameter.InputType,
            ValueSourceType = parameter.ValueSourceType,
            IsRequired = parameter.IsRequired,
            AllowMultipleValues = parameter.AllowMultipleValues,
            AllowRangeValues = parameter.AllowRangeValues,
            IsVisible = parameter.IsVisible,
            DataSourceId = request.DataSourceId,
            SqlQuery = parameter.LovConfig?.SqlQuery,
            ValueField = parameter.LovConfig?.ValueField,
            DisplayField = parameter.LovConfig?.DisplayField,
            DefaultValue = parameter.DefaultValue,
            Description = parameter.Description,
            IsEnabled = true,
            CreatedBy = userId,
            CreatedAt = now
        };

        _dbContext.CommonParameterTemplates.Add(template);
        return (template, null);
    }

    private static void ApplyTemplate(
        ReportParameter parameter,
        CommonParameterTemplate template,
        DateTime now)
    {
        parameter.CommonTemplateId = template.TemplateId;
        parameter.DisplayName = template.TemplateName;
        parameter.DataType = template.DataType;
        parameter.InputType = template.InputType;
        parameter.ValueSourceType = template.ValueSourceType;
        parameter.IsRequired = template.IsRequired;
        parameter.AllowMultipleValues = template.AllowMultipleValues;
        parameter.AllowRangeValues = template.AllowRangeValues;
        parameter.IsVisible = template.IsVisible;
        parameter.DefaultValue = template.DefaultValue;
        parameter.Description = template.Description;

        ApplyLovConfiguration(
            parameter,
            template.DataSourceId,
            template.SqlQuery,
            template.ValueField,
            template.DisplayField,
            now);
    }

    private static void ApplyManualConfiguration(
        ReportParameter parameter,
        UpdateAdminReportParameterRequest request,
        DateTime now)
    {
        parameter.CommonTemplateId = null;
        parameter.CommonTemplate = null;
        parameter.DisplayName = request.DisplayName!.Trim();
        parameter.DataType = CanonicalValue(request.DataType!, AllowedDataTypes);
        parameter.InputType = CanonicalValue(request.InputType!, AllowedInputTypes);
        parameter.ValueSourceType = CanonicalValue(request.ValueSourceType!, AllowedValueSourceTypes);
        parameter.IsRequired = request.IsRequired;
        parameter.AllowMultipleValues = request.AllowMultipleValues;
        parameter.AllowRangeValues = request.AllowRangeValues;
        parameter.IsVisible = request.IsVisible;
        parameter.DefaultValue = TrimToNull(request.DefaultValue);
        parameter.Description = TrimToNull(request.Description);

        ApplyLovConfiguration(
            parameter,
            request.DataSourceId,
            request.SqlQuery,
            request.ValueField,
            request.DisplayField,
            now);
    }

    private static void ApplyLovConfiguration(
        ReportParameter parameter,
        long? dataSourceId,
        string? sqlQuery,
        string? valueField,
        string? displayField,
        DateTime now)
    {
        if (!string.Equals(parameter.ValueSourceType, "SqlLov", StringComparison.OrdinalIgnoreCase))
        {
            parameter.LovConfig = null;
            return;
        }

        if (parameter.LovConfig == null)
        {
            parameter.LovConfig = new ParameterLovConfig
            {
                CreatedAt = now
            };
        }
        else
        {
            parameter.LovConfig.UpdatedAt = now;
        }

        parameter.LovConfig.DataSourceId = dataSourceId!.Value;
        parameter.LovConfig.SqlQuery = sqlQuery!.Trim();
        parameter.LovConfig.ValueField = valueField!.Trim();
        parameter.LovConfig.DisplayField = displayField!.Trim();
    }

    private static bool TemplateMatchesParameter(
        CommonParameterTemplate template,
        ReportParameter parameter)
    {
        return string.Equals(template.NormalizedParameterName,
                   NormalizeParameterName(parameter.ParameterName),
                   StringComparison.OrdinalIgnoreCase) &&
               string.Equals(template.DataType, parameter.DataType, StringComparison.OrdinalIgnoreCase) &&
               template.AllowMultipleValues == parameter.AllowMultipleValues &&
               template.AllowRangeValues == parameter.AllowRangeValues;
    }

    private static bool TryValidateTemplate(
        CommonParameterTemplate template,
        out string? error)
    {
        if (string.Equals(template.ValueSourceType, "SqlLov", StringComparison.OrdinalIgnoreCase) &&
            (!template.DataSourceId.HasValue ||
             string.IsNullOrWhiteSpace(template.SqlQuery) ||
             string.IsNullOrWhiteSpace(template.ValueField) ||
             string.IsNullOrWhiteSpace(template.DisplayField) ||
             !IsReadOnlySelect(template.SqlQuery)))
        {
            error = "常用參數的 SQL LOV 設定不完整或不是允許的唯讀查詢。";
            return false;
        }

        error = null;
        return true;
    }

    private static AdminReportParametersResponse ToResponse(Report report)
    {
        var parameters = report.ReportParameters
            .OrderBy(parameter => parameter.DisplayOrder)
            .Select(ToDto)
            .ToList();

        return new AdminReportParametersResponse
        {
            ReportId = report.ReportId,
            ReportCode = report.ReportCode,
            ReportName = report.ReportName,
            ConfigurationStatus = report.ConfigurationStatus,
            IsEnabled = report.IsEnabled,
            AllParametersConfigured = report.ReportParameters.All(parameter =>
                parameter.IsConfigured &&
                (!string.Equals(parameter.ValueSourceType, "SqlLov", StringComparison.OrdinalIgnoreCase) ||
                 parameter.LovConfig != null)),
            Parameters = parameters
        };
    }

    private static AdminReportParameterDto ToDto(ReportParameter parameter)
    {
        return new AdminReportParameterDto
        {
            ParameterId = parameter.ParameterId,
            ParameterName = parameter.ParameterName,
            DisplayName = parameter.DisplayName,
            DataType = parameter.DataType,
            InputType = parameter.InputType,
            ValueSourceType = parameter.ValueSourceType,
            IsRequired = parameter.IsRequired,
            AllowMultipleValues = parameter.AllowMultipleValues,
            AllowRangeValues = parameter.AllowRangeValues,
            IsVisible = parameter.IsVisible,
            DefaultValue = parameter.DefaultValue,
            Description = parameter.Description,
            DisplayOrder = parameter.DisplayOrder,
            IsConfigured = parameter.IsConfigured,
            CommonTemplateId = parameter.CommonTemplateId,
            CommonTemplateName = parameter.CommonTemplate?.TemplateName,
            DataSourceId = parameter.LovConfig?.DataSourceId,
            SqlQuery = parameter.LovConfig?.SqlQuery,
            ValueField = parameter.LovConfig?.ValueField,
            DisplayField = parameter.LovConfig?.DisplayField
        };
    }

    private void AddAuditLog(
        long userId,
        long reportId,
        string action,
        string details,
        DateTime now)
    {
        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            ReportId = reportId,
            Action = action,
            Result = "SUCCESS",
            Details = details,
            CreatedAt = now
        });
    }

    private bool TryGetUserId(out long userId)
    {
        return long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
    }

    private static bool IsReadOnlySelect(string sql)
    {
        var normalized = $" {sql.Trim().ToLowerInvariant()} ";
        return normalized.StartsWith(" select ", StringComparison.Ordinal) &&
               ForbiddenSqlFragments.All(fragment =>
                   !normalized.Contains(fragment, StringComparison.Ordinal));
    }

    private static string NormalizeParameterName(string parameterName)
    {
        var name = parameterName.Trim();
        var atIndex = name.IndexOf('@');
        return (atIndex > 0 ? name[..atIndex] : name).Trim().ToUpperInvariant();
    }

    private static string CanonicalValue(string value, IEnumerable<string> allowedValues)
    {
        return allowedValues.Single(allowed =>
            string.Equals(allowed, value.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    private static string? TrimToNull(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
