namespace CrystalReportPortal.CrystalService.Models
{
    public class CrystalLovRequest
    {
        public CrystalDatabaseConfig Database { get; set; }

        public string SqlQuery { get; set; }

        public string ValueField { get; set; }

        public string DisplayField { get; set; }

        public int MaxRows { get; set; } = 1000;
    }
}