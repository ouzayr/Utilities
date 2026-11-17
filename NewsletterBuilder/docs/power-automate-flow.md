# Power Automate flow – send scheduled newsletters

The SPFx web part never sends email itself. It writes:

| Where | What |
|---|---|
| Library (default **Newsletters**) | `<name>.newsletter.json` (editable source), `<name>.email.html` (rendered email), `<name>.mail.json` (ready-to-send Microsoft Graph message: subject, HTML body with `cid:` images, inline image attachments) |
| List (default **Newsletter Schedule**) | One row per scheduled send |

A flow polls the list and sends due items through Microsoft Graph `sendMail` using the **Office 365 Outlook → Send an HTTP request** action. Images are sent as inline attachments, so they display in classic Outlook, new Outlook, OWA and mobile.

## Schedule list columns (internal names)

| Column | Internal name | Notes |
|---|---|---|
| Title | `Title` | Newsletter title |
| Newsletter file | `NLNewsletterFile` | Server-relative URL of `.newsletter.json` |
| Mail package URL | `NLMailPackageUrl` | Server-relative URL of `.mail.json` – **the flow reads this** |
| Email subject | `NLEmailSubject` | Overrides the subject in the package |
| Scheduled send | `NLScheduledSend` | Stored in UTC |
| To / Cc / Bcc | `NLToRecipients`, `NLCcRecipients`, `NLBccRecipients` | `;`-separated emails (DLs and M365 group addresses work too) |
| Recipient group IDs | `NLRecipientGroupIds` | `;`-separated Entra ID / M365 group object IDs, expanded by the flow |
| Send from | `NLSendFrom` | Optional shared mailbox (flow owner needs **Send As**) |
| Importance | `NLImportance` | `low` / `normal` / `high` |
| Send status | `NLSendStatus` | `Draft`, `Scheduled`, `Sending`, `Sent`, `Failed`, `Cancelled` |
| Sent on | `NLSentOn` | Set by the flow |
| Status message | `NLStatusMessage` | Error text from the flow |

You can add your own columns to the list (e.g. "Approved by"); the web part ignores columns it doesn't know.

## Build the flow (≈ 15 minutes)

Create a **Scheduled cloud flow**, run every **15 minutes** (or 5). Use a service/shared account as the owner if possible.

### 1. Initialize variables (top level, before any loop)

| Name | Type | Value |
|---|---|---|
| `varTo` | Array | *(empty)* |
| `varCc` | Array | *(empty)* |
| `varBcc` | Array | *(empty)* |

### 2. SharePoint → Get items

- Site address: your site
- List name: `Newsletter Schedule`
- Filter Query:
  ```
  NLSendStatus eq 'Scheduled' and NLScheduledSend le '@{utcNow()}'
  ```
- Top Count: `20`

### 3. Apply to each → `value` of Get items

**Settings → Concurrency control: ON, degree of parallelism = 1** (variables are shared).

Inside the loop, in this order:

**3a. SharePoint → Update item** – Id = `ID`, `Send status` = `Sending`. This prevents a double send if the next run starts before this one finishes.

**3b. Set variable** `varTo` = (expression)
```
if(empty(items('Apply_to_each')?['NLToRecipients']), json('[]'), split(replace(items('Apply_to_each')?['NLToRecipients'], ' ', ''), ';'))
```
Repeat for `varCc` (`NLCcRecipients`) and `varBcc` (`NLBccRecipients`).

**3c. Expand groups** (skip if you never use group IDs)
- *Apply to each* over `split(coalesce(items('Apply_to_each')?['NLRecipientGroupIds'], ''), ';')`
  - *Condition*: `trim(item())` is not equal to *(empty)*
    - **Office 365 Groups → List group members**, Group Id = `trim(item())`
      (for very large groups use *HTTP with Microsoft Entra ID* `GET /groups/{id}/transitiveMembers/microsoft.graph.user?$select=mail&$top=999`)
    - *Apply to each* member → *Append to array variable* `varBcc` = `items('Apply_to_each_member')?['mail']`

  Group members go to **Bcc** so recipients don't see each other. Alternatively put the group's email address in **To** and skip this step entirely.

**3d. SharePoint → Send an HTTP request to SharePoint** (read the mail package)
- Method: `GET`
- Uri:
  ```
  _api/web/GetFileByServerRelativeUrl('@{replace(items('Apply_to_each')?['NLMailPackageUrl'], '''', '''''')}')/$value
  ```

**3e. Compose** `Mail package`
```
json(body('Send_an_HTTP_request_to_SharePoint'))
```
*(If it arrives as base64 `$content`, use `json(base64ToString(body('Send_an_HTTP_request_to_SharePoint')?['$content']))`.)*

**3f. Select** ×3 – turn email strings into Graph recipients. For `To`:
- From: `variables('varTo')`
- Map (switch to text mode):
  ```
  { "emailAddress": { "address": "@{trim(item())}" } }
  ```
Name them `Select_To`, `Select_Cc`, `Select_Bcc`. Add a *Filter array* before each if you want to drop blanks (`trim(item())` is not equal to empty).

**3g. Compose** `Graph body`
```json
{
  "message": {
    "subject": "@{coalesce(items('Apply_to_each')?['NLEmailSubject'], outputs('Mail_package')?['subject'])}",
    "importance": "@{coalesce(items('Apply_to_each')?['NLImportance']?['Value'], 'normal')}",
    "body": @{outputs('Mail_package')?['body']},
    "toRecipients": @{body('Select_To')},
    "ccRecipients": @{body('Select_Cc')},
    "bccRecipients": @{body('Select_Bcc')},
    "attachments": @{outputs('Mail_package')?['attachments']}
  },
  "saveToSentItems": true
}
```

**3h. Office 365 Outlook → Send an HTTP request**
- URI:
  ```
  @{if(empty(items('Apply_to_each')?['NLSendFrom']), 'https://graph.microsoft.com/v1.0/me/sendMail', concat('https://graph.microsoft.com/v1.0/users/', items('Apply_to_each')?['NLSendFrom'], '/sendMail'))}
  ```
- Method: `POST`
- Body: `outputs('Graph_body')`
- Content-Type: `application/json`

**3i. SharePoint → Update item** – `Send status` = `Sent`, `Sent on` = `utcNow()`, `Status message` = *(empty)*.

**3j. Error handling** – add a parallel branch after **3h** with *Configure run after → has failed / has timed out*:
SharePoint → Update item – `Send status` = `Failed`, `Status message` = `@{body('Send_an_HTTP_request')?['error']?['message']}`.
Failed rows can be re-queued from the web part (**Schedules → Re-queue**).

## Limits and gotchas

- **4 MB request limit** on Graph `sendMail`. The web part blocks scheduling above ~3.6 MB. Uploaded images are already resized/compressed; if you hit the limit, use fewer or smaller images, or link images from a public URL instead of uploading.
- **500 recipients per message** (Exchange default). For bigger audiences send to a distribution list/M365 group address, or split Bcc into batches with *Chunk*.
- **Send from shared mailbox** requires the flow owner to have *Send As* (or *Send on behalf*) rights on that mailbox.
- The flow sends the **latest saved** version of the newsletter at send time.
- Choice columns come back as objects from *Get items* (`?['NLSendStatus']?['Value']`) – use `?['Value']` if you add conditions on them.

## Simpler alternative (not recommended)

*Office 365 Outlook → Send an email (V2)* with Body = contents of `<name>.email.html`. It works in OWA/new Outlook, but images are embedded as `data:` URIs that **classic Outlook for Windows does not display**. Use the Graph approach above for reliable images.
