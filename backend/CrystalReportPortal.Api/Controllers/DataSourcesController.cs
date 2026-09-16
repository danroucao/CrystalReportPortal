using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Controllers;

[ApiController]
[Route("api/data-sources")]
[Authorize(Roles = "ADMIN")]
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