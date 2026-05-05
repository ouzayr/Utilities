using CardForge.Application.Interfaces;
using System.Text;

namespace CardForge.Infrastructure.Identity;

public class VcfGenerator : IVcfGenerator
{
    public string Generate(VcfContact contact)
    {
        var sb = new StringBuilder();
        sb.AppendLine("BEGIN:VCARD");
        sb.AppendLine("VERSION:3.0");
        sb.AppendLine($"N:{contact.LastName};{contact.FirstName};;;");
        sb.AppendLine($"FN:{contact.FirstName} {contact.LastName}");

        if (!string.IsNullOrWhiteSpace(contact.JobTitle))
            sb.AppendLine($"TITLE:{contact.JobTitle}");

        if (!string.IsNullOrWhiteSpace(contact.Company))
            sb.AppendLine($"ORG:{contact.Company}");

        if (!string.IsNullOrWhiteSpace(contact.Phone))
            sb.AppendLine($"TEL;TYPE=WORK,VOICE:{contact.Phone}");

        if (!string.IsNullOrWhiteSpace(contact.Email))
            sb.AppendLine($"EMAIL;TYPE=INTERNET:{contact.Email}");

        if (!string.IsNullOrWhiteSpace(contact.Website))
            sb.AppendLine($"URL:{contact.Website}");

        sb.AppendLine("END:VCARD");
        return sb.ToString();
    }
}
