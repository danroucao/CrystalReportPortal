using System.Collections.Generic;

namespace CrystalReportPortal.CrystalService.Models
{
    public class CrystalExportParameter
    {
        public string Name { get; set; }

        public string DataType { get; set; }

        public List<string> Values { get; set; }
            = new List<string>();
    }
}