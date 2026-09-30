using System.Security.Cryptography;

namespace BidNet.Services;

public static class PasswordHasher
{
    private const int PasswordIterations = 210_000;

    public static (byte[] Hash, byte[] Salt) Create(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        return (Hash(password, salt), salt);
    }

    public static byte[] Hash(string password, byte[] salt) =>
        Rfc2898DeriveBytes.Pbkdf2(password, salt, PasswordIterations, HashAlgorithmName.SHA256, 32);
}