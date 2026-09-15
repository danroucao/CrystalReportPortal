namespace CrystalReportPortal.CrystalService.Models
{
    public class CrystalDatabaseTestResponse
    {
        public bool Success { get; set; }

        public bool Connected { get; set; }

        public string Server { get; set; }

        public string Database { get; set; }

        public string LoginName { get; set; }

        public long DetailCount { get; set; }

        public long ElapsedMilliseconds { get; set; }

        public string Message { get; set; }
    }
}