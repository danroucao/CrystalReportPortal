namespace CrystalReportPortal.Api.Authorization;

public static class BackOfficeSessionKeys
{
    public const string SharedVerifiedAtUtc =
        "BackOffice.SharedVerifiedAtUtc";

    public const string OperatorVerifyFailedCount =
        "BackOffice.OperatorVerifyFailedCount";

    public const string OperatorUserId =
        "BackOffice.OperatorUserId";

    public const string OperatorAccount =
        "BackOffice.OperatorAccount";

    public const string OperatorUserName =
        "BackOffice.OperatorUserName";

    public static void ClearSharedVerification(
        ISession session)
    {
        session.Remove(SharedVerifiedAtUtc);
        session.Remove(OperatorVerifyFailedCount);
    }

    public static void ClearOperator(
        ISession session)
    {
        session.Remove(OperatorUserId);
        session.Remove(OperatorAccount);
        session.Remove(OperatorUserName);
    }

    public static void ClearAll(
        ISession session)
    {
        ClearSharedVerification(session);
        ClearOperator(session);
    }
}