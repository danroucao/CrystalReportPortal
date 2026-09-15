using System.Collections.Generic;

namespace CrystalReportPortal.CrystalService.Models
{
    public class CrystalLovResponse
    {
        public bool Success { get; set; }

        public string Message { get; set; }

        public int Count { get; set; }

        public long ElapsedMilliseconds { get; set; }

        public List<CrystalLovOption> Options { get; set; }
            = new List<CrystalLovOption>();
    }
}