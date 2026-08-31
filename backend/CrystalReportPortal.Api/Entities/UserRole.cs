namespace CrystalReportPortal.Api.Entities;

public class UserRole
{
    public long UserId { get; set; }

    public int RoleId { get; set; }

    public DateTime CreatedAt { get; set; }


    // Navigation Properties
    public User User { get; set; } = null!;

    public Role Role { get; set; } = null!;
}