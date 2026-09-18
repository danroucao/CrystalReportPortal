using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Services;
using CrystalReportPortal.Api.Authorization;
using CrystalReportPortal.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/data-sources")]
[Authorize(Policy = PermissionCodes.DataSourceManage)]
public class DataSourcesController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly ICredentialProtector _credentialProtector;
    private readonly ICrystalProcessService _crystalProcessService;
    private readonly ILogger<DataSourcesController> _logger;

    public DataSourcesController(
        AppDbContext dbContext,
        ICredentialProtector credentialProtector,
        ICrystalProcessService crystalProcessService,
        ILogger<DataSourcesController> logger)
    {
        _dbContext = dbContext;
        _credentialProtector = credentialProtector;
        _crystalProcessService = crystalProcessService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DataSourceManagementDto>>> GetDataSources()
    {
        var dataSources = await _dbContext.ReportDataSources
            .AsNoTracking()
            .Include(source => source.Credentials)
            .OrderBy(source => source.DataSourceName)
            .Select(source => new DataSourceManagementDto
            {
                DataSourceId = source.DataSourceId,
                DataSourceName = source.DataSourceName,
                ServerHost = source.ServerHost,
                Port = source.Port,
                DatabaseName = source.DatabaseName,
                IsEnabled = source.IsEnabled,
                AuthenticationType = source.Credentials
                    .Where(credential => credential.CredentialType == "ReadOnly")
                    .Select(credential => credential.AuthenticationType)
                    .FirstOrDefault() ?? "SqlServer",
                Username = source.Credentials
                    .Where(credential => credential.CredentialType == "ReadOnly")
                    .Select(credential => credential.Username)
                    .FirstOrDefault() ?? string.Empty,
                HasPassword = source.Credentials.Any(credential =>
                    credential.CredentialType == "ReadOnly" &&
                    credential.EncryptedPassword != string.Empty)
            }).ToListAsync();
        return Ok(dataSources);
    }

    [HttpPost]
    public async Task<ActionResult<DataSourceManagementDto>> CreateDataSource(SaveDataSourceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DataSourceName) ||
            string.IsNullOrWhiteSpace(request.ServerHost) ||
            string.IsNullOrWhiteSpace(request.DatabaseName) || request.Port <= 0)
        {
            return BadRequest(new { message = "資料來源、主機、連接埠與資料庫名稱為必填。" });
        }
        var source = new ReportDataSource
        {
            DataSourceName = request.DataSourceName.Trim(),
            ServerHost = request.ServerHost.Trim(),
            Port = request.Port,
            DatabaseName = request.DatabaseName.Trim(),
            IsEnabled = request.IsEnabled,
            CreatedAt = DateTime.UtcNow
        };
        source.Credentials.Add(new DataSourceCredential
        {
            CredentialType = "ReadOnly",
            AuthenticationType = "SqlServer",
            Username = string.Empty,
            EncryptedPassword = string.Empty,
            CreatedAt = DateTime.UtcNow
        });
        _dbContext.ReportDataSources.Add(source);
        await _dbContext.SaveChangesAsync();
        return CreatedAtAction(nameof(GetDataSources), new { id = source.DataSourceId }, new DataSourceManagementDto
        {
            DataSourceId = source.DataSourceId, DataSourceName = source.DataSourceName,
            ServerHost = source.ServerHost, Port = source.Port, DatabaseName = source.DatabaseName,
            IsEnabled = source.IsEnabled
        });
    }

    [HttpPut("{dataSourceId:long}")]
    public async Task<ActionResult<DataSourceManagementDto>> UpdateDataSource(long dataSourceId, SaveDataSourceRequest request)
    {
        var source = await _dbContext.ReportDataSources.FindAsync(dataSourceId);
        if (source == null) return NotFound(new { message = "找不到指定的資料來源。" });
        source.DataSourceName = request.DataSourceName.Trim();
        source.ServerHost = request.ServerHost.Trim();
        source.Port = request.Port;
        source.DatabaseName = request.DatabaseName.Trim();
        source.IsEnabled = request.IsEnabled;
        source.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
        return Ok(new DataSourceManagementDto
        {
            DataSourceId = source.DataSourceId, DataSourceName = source.DataSourceName,
            ServerHost = source.ServerHost, Port = source.Port, DatabaseName = source.DatabaseName,
            IsEnabled = source.IsEnabled
        });
    }

    [HttpGet("{dataSourceId:long}/credentials/read-only")]
    public async Task<ActionResult<DataSourceCredentialResponse>>
    GetReadOnlyCredential(long dataSourceId)
    {
        var dataSource =
            await _dbContext.ReportDataSources
                .AsNoTracking()
                .Include(x => x.Credentials)
                .FirstOrDefaultAsync(x =>
                    x.DataSourceId == dataSourceId);

        if (dataSource == null)
        {
            return NotFound(new
            {
                success = false,
                message = "找不到指定的資料來源。"
            });
        }

        var credential =
            dataSource.Credentials.FirstOrDefault(x =>
                string.Equals(
                    x.CredentialType,
                    "ReadOnly",
                    StringComparison.OrdinalIgnoreCase));

        if (credential == null)
        {
            return NotFound(new
            {
                success = false,
                message = "此資料來源尚未建立 ReadOnly 憑證。"
            });
        }

        return Ok(new DataSourceCredentialResponse
        {
            DataSourceId = dataSource.DataSourceId,
            CredentialType = credential.CredentialType,
            AuthenticationType = credential.AuthenticationType,
            Username = credential.Username,
            HasPassword =
                !string.IsNullOrWhiteSpace(
                    credential.EncryptedPassword),
            UpdatedAt = credential.UpdatedAt
        });
    }

    [HttpPut("{dataSourceId:long}/credentials/read-only")]
    public async Task<ActionResult<DataSourceCredentialResponse>>
    UpdateReadOnlyCredential(
        long dataSourceId,
        [FromBody] UpdateDataSourceCredentialRequest request)
    {
        var authenticationType =
            request.AuthenticationType?.Trim();

        if (!string.Equals(
                authenticationType,
                "Windows",
                StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(
                authenticationType,
                "SqlServer",
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                success = false,
                message =
                    "AuthenticationType 只能是 Windows 或 SqlServer。"
            });
        }

        var dataSource =
            await _dbContext.ReportDataSources
                .Include(x => x.Credentials)
                .FirstOrDefaultAsync(x =>
                    x.DataSourceId == dataSourceId);

        if (dataSource == null)
        {
            return NotFound(new
            {
                success = false,
                message = "找不到指定的資料來源。"
            });
        }

        var credential =
            dataSource.Credentials.FirstOrDefault(x =>
                string.Equals(
                    x.CredentialType,
                    "ReadOnly",
                    StringComparison.OrdinalIgnoreCase));

        if (credential == null)
        {
            credential = new DataSourceCredential
            {
                DataSourceId = dataSource.DataSourceId,
                CredentialType = "ReadOnly",
                AuthenticationType = "SqlServer",
                Username = string.Empty,
                EncryptedPassword = string.Empty,
                CreatedAt = DateTime.UtcNow
            };
            dataSource.Credentials.Add(credential);
        }

        if (string.Equals(
                authenticationType,
                "SqlServer",
                StringComparison.OrdinalIgnoreCase))
        {
            var username = request.Username?.Trim();

            if (string.IsNullOrWhiteSpace(username))
            {
                return BadRequest(new
                {
                    success = false,
                    message =
                        "使用 SQL Server Authentication 時必須輸入帳號。"
                });
            }

            var hasNewPassword =
                !string.IsNullOrEmpty(request.Password);

            var hasExistingPassword =
                !string.IsNullOrWhiteSpace(
                    credential.EncryptedPassword);

            if (!hasNewPassword && !hasExistingPassword)
            {
                return BadRequest(new
                {
                    success = false,
                    message =
                        "使用 SQL Server Authentication 時必須輸入密碼。"
                });
            }

            credential.AuthenticationType = "SqlServer";
            credential.Username = username;

            if (hasNewPassword)
            {
                // 密碼不可 Trim，避免改變真正密碼內容。
                credential.EncryptedPassword =
                    _credentialProtector.Protect(
                        request.Password!);
            }
        }
        else
        {
            credential.AuthenticationType = "Windows";
            credential.Username = string.Empty;
            credential.EncryptedPassword = string.Empty;
        }

        credential.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return Ok(new DataSourceCredentialResponse
        {
            DataSourceId = dataSource.DataSourceId,
            CredentialType = credential.CredentialType,
            AuthenticationType = credential.AuthenticationType,
            Username = credential.Username,
            HasPassword =
                !string.IsNullOrWhiteSpace(
                    credential.EncryptedPassword),
            UpdatedAt = credential.UpdatedAt
        });
    }

    [HttpPost("{dataSourceId:long}/test")]
    public async Task<ActionResult<CrystalDatabaseTestResponse>>
        TestConnection(long dataSourceId)
    {
        var dataSource =
            await _dbContext.ReportDataSources
                .AsNoTracking()
                .Include(x => x.Credentials)
                .FirstOrDefaultAsync(x =>
                    x.DataSourceId == dataSourceId);

        if (dataSource == null)
        {
            return NotFound(
                new CrystalDatabaseTestResponse
                {
                    Success = false,
                    Connected = false,
                    Message = "找不到指定的資料來源。"
                });
        }

        if (!dataSource.IsEnabled)
        {
            return BadRequest(
                new CrystalDatabaseTestResponse
                {
                    Success = false,
                    Connected = false,
                    Server =
                        $"{dataSource.ServerHost}," +
                        $"{dataSource.Port}",
                    Database = dataSource.DatabaseName,
                    Message = "此資料來源目前未啟用。"
                });
        }

        var credential =
            dataSource.Credentials
                .FirstOrDefault(x =>
                    string.Equals(
                        x.CredentialType,
                        "ReadOnly",
                        StringComparison.OrdinalIgnoreCase));

        if (credential == null)
        {
            return BadRequest(
                new CrystalDatabaseTestResponse
                {
                    Success = false,
                    Connected = false,
                    Server =
                        $"{dataSource.ServerHost}," +
                        $"{dataSource.Port}",
                    Database = dataSource.DatabaseName,
                    Message =
                        "此資料來源尚未設定 ReadOnly 憑證。"
                });
        }

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
            if (string.IsNullOrWhiteSpace(
                    credential.Username))
            {
                return BadRequest(
                    new CrystalDatabaseTestResponse
                    {
                        Success = false,
                        Connected = false,
                        Server =
                            $"{dataSource.ServerHost}," +
                            $"{dataSource.Port}",
                        Database = dataSource.DatabaseName,
                        Message =
                            "SQL Server Authentication "
                            + "缺少資料庫帳號。"
                    });
            }

            if (string.IsNullOrWhiteSpace(
                    credential.EncryptedPassword))
            {
                return BadRequest(
                    new CrystalDatabaseTestResponse
                    {
                        Success = false,
                        Connected = false,
                        Server =
                            $"{dataSource.ServerHost}," +
                            $"{dataSource.Port}",
                        Database = dataSource.DatabaseName,
                        Message =
                            "SQL Server Authentication "
                            + "缺少資料庫密碼。"
                    });
            }

            username = credential.Username;

            try
            {
                password =
                    _credentialProtector.Unprotect(
                        credential.EncryptedPassword);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "無法解密資料來源 {DataSourceId} 的憑證。",
                    dataSourceId);

                return BadRequest(
                    new CrystalDatabaseTestResponse
                    {
                        Success = false,
                        Connected = false,
                        Server =
                            $"{dataSource.ServerHost}," +
                            $"{dataSource.Port}",
                        Database = dataSource.DatabaseName,
                        Message = "資料庫憑證無法解密。"
                    });
            }
        }
        else
        {
            return BadRequest(
                new CrystalDatabaseTestResponse
                {
                    Success = false,
                    Connected = false,
                    Server =
                        $"{dataSource.ServerHost}," +
                        $"{dataSource.Port}",
                    Database = dataSource.DatabaseName,
                    Message =
                        $"不支援的資料庫驗證方式："
                        + $"{credential.AuthenticationType}"
                });
        }

        var request =
            new CrystalDatabaseTestRequest
            {
                Server =
                    $"{dataSource.ServerHost}," +
                    $"{dataSource.Port}",

                Database =
                    dataSource.DatabaseName,

                IntegratedSecurity =
                    integratedSecurity,

                Username =
                    username,

                Password =
                    password
            };

        try
        {
            var response =
                await _crystalProcessService
                    .TestDatabaseConnectionAsync(request);

            if (!response.Success ||
                !response.Connected)
            {
                return BadRequest(response);
            }

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "測試資料來源 {DataSourceId} 連線時發生錯誤。",
                dataSourceId);

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new CrystalDatabaseTestResponse
                {
                    Success = false,
                    Connected = false,
                    Server = request.Server,
                    Database = request.Database,
                    Message =
                        "執行資料庫連線測試時發生錯誤。"
                });
        }
    }
}