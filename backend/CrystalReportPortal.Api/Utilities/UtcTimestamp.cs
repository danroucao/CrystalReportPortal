namespace CrystalReportPortal.Api.Utilities;

/// <summary>
/// Restores the UTC contract for timestamps read from SQL Server <c>datetime2</c>.
/// That SQL type stores the clock value but not <see cref="DateTime.Kind"/>, so EF
/// materializes values as <see cref="DateTimeKind.Unspecified"/>. API timestamps
/// in this application are persisted as UTC and must be marked accordingly before
/// JSON serialization, otherwise clients interpret them as their local time.
/// </summary>
public static class UtcTimestamp
{
    public static DateTime Restore(DateTime value) =>
        DateTime.SpecifyKind(value, DateTimeKind.Utc);

    public static DateTime? Restore(DateTime? value) =>
        value is null ? null : Restore(value.Value);
}
