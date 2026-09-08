namespace CrystalReportPortal.CrystalService.Models
{
    public class CrystalDatabaseConfig
    {
        public string Server { get; set; }

        public string Database { get; set; }

        public bool IntegratedSecurity { get; set; }

        public string Username { get; set; }

        public string Password { get; set; }
    }
}