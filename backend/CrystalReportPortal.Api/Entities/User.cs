namespace CrystalReportPortal.Api.Entities;

public class User
{
    public long UserId { get; set; }

    public string EmployeeNo { get; set; } = null!;

    public string UserName { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }


    // Navigation Property
    public ICollection<UserRole> UserRoles { get; set; }
        = new List<UserRole>();
}