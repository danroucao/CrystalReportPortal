using System.Security.Claims;
using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/backoffice/common-parameter-templates")]
[Authorize(Policy = "Report.SetParameters")]
public class CommonParameterTemplatesController : ControllerBase
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

    public CommonParameterTemplatesController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("data-sources")]
    public async Task<ActionResult<IReadOnlyList<DataSourceOptionDto>>>
    GetDataSourceOptions()
    {
        var dataSources = await _dbContext.ReportDataSources
            .AsNoTracking()
            .Where(dataSource => dataSource.IsEnabled)
            .OrderBy(dataSource => dataSource.DataSourceName)
            .Select(dataSource => new DataSourceOptionDto
            {
                DataSourceId = dataSource.DataSourceId,
                DataSourceName = dataSource.DataSourceName
            })
            .ToListAsync();

        return Ok(dataSources);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CommonParameterTemplateDto>>> GetTemplates(
        [FromQuery] bool? isEnabled = null)
    {
        var query = _dbContext.CommonParameterTemplates
            .AsNoTracking()
            .AsQueryable();

        if (isEnabled.HasValue)
        {
            query = query.Where(template => template.IsEnabled == isEnabled.Value);
        }

        var templates = await query
            .Include(template => template.DataSource)
            .OrderBy(template => template.TemplateName)
            .ThenBy(template => template.TemplateCode)
            .ToListAsync();

        return Ok(templates.Select(ToDto).ToList());
    }

    [HttpGet("{templateId:long}")]
    public async Task<ActionResult<CommonParameterTemplateDto>> GetTemplate(long templateId)
    {
        var template = await _dbContext.CommonParameterTemplates
            .AsNoTracking()
            .Include(candidate => candidate.DataSource)
            .Where(candidate => candidate.TemplateId == templateId)
            .SingleOrDefaultAsync();

        return template == null
            ? NotFound(new { message = "找不到指定的常用參數。" })
            : Ok(ToDto(template));
    }

    [HttpPost]
    public async Task<ActionResult<CommonParameterTemplateDto>> CreateTemplate(
        SaveCommonParameterTemplateRequest request)
    {
        if (!TryGetOperatorId(out var operatorId))
        {
            return Unauthorized();
        }

        var validationResult = await ValidateRequestAsync(request);
        if (validationResult != null)
        {
            return validationResult;
        }

        var templateCode = request.TemplateCode.Trim();
        if (await _dbContext.CommonParameterTemplates.AnyAsync(
                candidate => candidate.TemplateCode == templateCode))
        {
            return Conflict(new { message = "常用參數代碼已存在。" });
        }

        var duplicateResult = await CheckDuplicateMatchRuleAsync(request, null);
        if (duplicateResult != null)
        {
            return duplicateResult;
        }

        var now = DateTime.UtcNow;
        var template = new CommonParameterTemplate
        {
            CreatedBy = operatorId,
            CreatedAt = now,
            IsEnabled = true
        };

        ApplyRequest(template, request);
        _dbContext.CommonParameterTemplates.Add(template);
        AddAuditLog(operatorId, "CREATE_COMMON_PARAMETER_TEMPLATE", templateCode, now);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetTemplate),
            new { templateId = template.TemplateId },
            await LoadDtoAsync(template.TemplateId));
    }

    [HttpPut("{templateId:long}")]
    public async Task<ActionResult<CommonParameterTemplateDto>> UpdateTemplate(
        long templateId,
        SaveCommonParameterTemplateRequest request)
    {
        if (!TryGetOperatorId(out var operatorId))
        {
            return Unauthorized();
        }

        var template = await _dbContext.CommonParameterTemplates
            .SingleOrDefaultAsync(candidate => candidate.TemplateId == templateId);

        if (template == null)
        {
            return NotFound(new { message = "找不到指定的常用參數。" });
        }

        var validationResult = await ValidateRequestAsync(request);
        if (validationResult != null)
        {
            return validationResult;
        }

        var templateCode = request.TemplateCode.Trim();
        if (await _dbContext.CommonParameterTemplates.AnyAsync(candidate =>
                candidate.TemplateId != templateId &&
                candidate.TemplateCode == templateCode))
        {
            return Conflict(new { message = "常用參數代碼已存在。" });
        }

        if (template.IsEnabled)
        {
            var duplicateResult = await CheckDuplicateMatchRuleAsync(request, templateId);
            if (duplicateResult != null)
            {
                return duplicateResult;
            }
        }

        var now = DateTime.UtcNow;
        ApplyRequest(template, request);
        template.UpdatedBy = operatorId;
        template.UpdatedAt = now;

        AddAuditLog(operatorId, "UPDATE_COMMON_PARAMETER_TEMPLATE", templateCode, now);
        await _dbContext.SaveChangesAsync();

        return Ok(await LoadDtoAsync(templateId));
    }

    [HttpPatch("{templateId:long}/status")]
    public async Task<ActionResult<CommonParameterTemplateDto>> UpdateStatus(
        long templateId,
        UpdateCommonParameterTemplateStatusRequest request)
    {
        if (!TryGetOperatorId(out var operatorId))
        {
            return Unauthorized();
        }

        var template = await _dbContext.CommonParameterTemplates
            .SingleOrDefaultAsync(candidate => candidate.TemplateId == templateId);

        if (template == null)
        {
            return NotFound(new { message = "找不到指定的常用參數。" });
        }

        if (request.IsEnabled)
        {
            var duplicateRequest = new SaveCommonParameterTemplateRequest
            {
                TemplateCode = template.TemplateCode,
                TemplateName = template.TemplateName,
                NormalizedParameterName = template.NormalizedParameterName,
                DataType = template.DataType,
                InputType = template.InputType,
                ValueSourceType = template.ValueSourceType,
                IsRequired = template.IsRequired,
                AllowMultipleValues = template.AllowMultipleValues,
                AllowRangeValues = template.AllowRangeValues,
                IsVisible = template.IsVisible,
                DataSourceId = template.DataSourceId,
                SqlQuery = template.SqlQuery,
                ValueField = template.ValueField,
                DisplayField = template.DisplayField
            };

            var duplicateResult = await CheckDuplicateMatchRuleAsync(duplicateRequest, templateId);
            if (duplicateResult != null)
            {
                return duplicateResult;
            }
        }

        var now = DateTime.UtcNow;
        template.IsEnabled = request.IsEnabled;
        template.UpdatedBy = operatorId;
        template.UpdatedAt = now;

        AddAuditLog(
            operatorId,
            request.IsEnabled
                ? "ENABLE_COMMON_PARAMETER_TEMPLATE"
                : "DISABLE_COMMON_PARAMETER_TEMPLATE",
            template.TemplateCode,
            now);

        await _dbContext.SaveChangesAsync();
        return Ok(await LoadDtoAsync(templateId));
    }

    private async Task<ActionResult?> ValidateRequestAsync(
        SaveCommonParameterTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TemplateCode) ||
            string.IsNullOrWhiteSpace(request.TemplateName) ||
            string.IsNullOrWhiteSpace(request.NormalizedParameterName))
        {
            return BadRequest(new { message = "常用參數代碼、名稱及正規化參數名稱不可空白。" });
        }

        if (request.TemplateCode.Trim().Length > 100 ||
            request.TemplateName.Trim().Length > 200 ||
            request.NormalizedParameterName.Trim().Length > 200 ||
            TrimToNull(request.ValueField)?.Length > 200 ||
            TrimToNull(request.DisplayField)?.Length > 200 ||
            TrimToNull(request.Description)?.Length > 1000)
        {
            return BadRequest(new { message = "常用參數欄位長度超過資料庫限制。" });
        }

        if (request.NormalizedParameterName.Contains('@'))
        {
            return BadRequest(new { message = "正規化參數名稱不可包含 @ 或 RPT 內嵌 SQL。" });
        }

        if (!AllowedDataTypes.Contains(request.DataType) ||
            !AllowedInputTypes.Contains(request.InputType) ||
            !AllowedValueSourceTypes.Contains(request.ValueSourceType))
        {
            return BadRequest(new { message = "DataType、InputType 或 ValueSourceType 不在允許範圍內。" });
        }

        if (request.AllowMultipleValues && request.AllowRangeValues)
        {
            return BadRequest(new { message = "參數不可同時設定為多值與範圍值。" });
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
                return BadRequest(new { message = "SQL LOV 僅允許單一 SELECT 查詢，且不可包含註解或資料異動指令。" });
            }
        }

        return null;
    }

    private async Task<ActionResult?> CheckDuplicateMatchRuleAsync(
        SaveCommonParameterTemplateRequest request,
        long? excludedTemplateId)
    {
        var normalizedName = NormalizeParameterName(request.NormalizedParameterName);
        var dataType = CanonicalValue(request.DataType, AllowedDataTypes);

        var duplicateExists = await _dbContext.CommonParameterTemplates.AnyAsync(candidate =>
            candidate.IsEnabled &&
            (!excludedTemplateId.HasValue || candidate.TemplateId != excludedTemplateId.Value) &&
            candidate.NormalizedParameterName == normalizedName &&
            candidate.DataType == dataType &&
            candidate.AllowMultipleValues == request.AllowMultipleValues &&
            candidate.AllowRangeValues == request.AllowRangeValues &&
            candidate.DataSourceId == request.DataSourceId);

        return duplicateExists
            ? Conflict(new { message = "已有相同匹配條件的啟用模板，請修改原模板或先將其停用。" })
            : null;
    }

    private static void ApplyRequest(
        CommonParameterTemplate template,
        SaveCommonParameterTemplateRequest request)
    {
        template.TemplateCode = request.TemplateCode.Trim();
        template.TemplateName = request.TemplateName.Trim();
        template.NormalizedParameterName = NormalizeParameterName(request.NormalizedParameterName);
        template.DataType = CanonicalValue(request.DataType, AllowedDataTypes);
        template.InputType = CanonicalValue(request.InputType, AllowedInputTypes);
        template.ValueSourceType = CanonicalValue(request.ValueSourceType, AllowedValueSourceTypes);
        template.IsRequired = request.IsRequired;
        template.AllowMultipleValues = request.AllowMultipleValues;
        template.AllowRangeValues = request.AllowRangeValues;
        template.IsVisible = request.IsVisible;
        template.DataSourceId = request.DataSourceId;
        template.DefaultValue = TrimToNull(request.DefaultValue);
        template.Description = TrimToNull(request.Description);

        if (string.Equals(template.ValueSourceType, "SqlLov", StringComparison.OrdinalIgnoreCase))
        {
            template.SqlQuery = request.SqlQuery!.Trim();
            template.ValueField = request.ValueField!.Trim();
            template.DisplayField = request.DisplayField!.Trim();
        }
        else
        {
            template.SqlQuery = null;
            template.ValueField = null;
            template.DisplayField = null;
        }
    }

    private void AddAuditLog(long operatorId, string action, string templateCode, DateTime now)
    {
        _dbContext.AuditLogs.Add(new AuditLog
        {
            UserId = operatorId,
            Action = action,
            Result = "SUCCESS",
            Details = $"常用參數模板 {templateCode}",
            CreatedAt = now
        });
    }

    private bool TryGetOperatorId(out long operatorId)
    {
        return long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out operatorId);
    }

    private async Task<CommonParameterTemplateDto> LoadDtoAsync(long templateId)
    {
        var template = await _dbContext.CommonParameterTemplates
            .AsNoTracking()
            .Include(template => template.DataSource)
            .Where(template => template.TemplateId == templateId)
            .SingleAsync();

        return ToDto(template);
    }

    private static CommonParameterTemplateDto ToDto(CommonParameterTemplate template)
    {
        return new CommonParameterTemplateDto
        {
            TemplateId = template.TemplateId,
            TemplateCode = template.TemplateCode,
            TemplateName = template.TemplateName,
            NormalizedParameterName = template.NormalizedParameterName,
            DataType = template.DataType,
            InputType = template.InputType,
            ValueSourceType = template.ValueSourceType,
            IsRequired = template.IsRequired,
            AllowMultipleValues = template.AllowMultipleValues,
            AllowRangeValues = template.AllowRangeValues,
            IsVisible = template.IsVisible,
            DataSourceId = template.DataSourceId,
            DataSourceName = template.DataSource == null ? null : template.DataSource.DataSourceName,
            SqlQuery = template.SqlQuery,
            ValueField = template.ValueField,
            DisplayField = template.DisplayField,
            DefaultValue = template.DefaultValue,
            Description = template.Description,
            IsEnabled = template.IsEnabled,
            CreatedBy = template.CreatedBy,
            CreatedAt = template.CreatedAt,
            UpdatedBy = template.UpdatedBy,
            UpdatedAt = template.UpdatedAt
        };
    }

    private static bool IsReadOnlySelect(string sql)
    {
        var normalized = $" {sql.Trim().ToLowerInvariant()} ";
        return normalized.StartsWith(" select ", StringComparison.Ordinal) &&
               ForbiddenSqlFragments.All(fragment => !normalized.Contains(fragment, StringComparison.Ordinal));
    }

    private static string NormalizeParameterName(string value)
    {
        return value.Trim().ToUpperInvariant();
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
