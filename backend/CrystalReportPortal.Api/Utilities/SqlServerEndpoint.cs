namespace CrystalReportPortal.Api.Utilities;

public static class SqlServerEndpoint
{
    /// <summary>
    /// Formats either a fixed-port SQL Server endpoint (host,port) or a named
    /// instance endpoint (host\instance). Named instances deliberately omit a
    /// port so that SQL Server Browser can resolve their configured port.
    /// </summary>
    public static string Format(string serverHost, int? port)
    {
        var host = serverHost.Trim();
        return port.HasValue ? $"{host},{port.Value}" : host;
    }
}
