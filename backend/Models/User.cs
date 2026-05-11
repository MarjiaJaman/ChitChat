using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChitChat.Models
{
    [Table("users")]
    public class User
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("first_Name")]
        [MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [Column("last_Name")]
        [MaxLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Column("gender")]
        [MaxLength(10)]
        public string? Gender { get; set; }

        [Column("birth_Date")]
        public DateTime? BirthDate { get; set; }

        [Required]
        [Column("email")]
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [Column("password")]
        [MaxLength(255)]
        public string Password { get; set; } = string.Empty;

        [Column("created_At")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_At")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
