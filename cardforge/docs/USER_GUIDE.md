# CardForge — User Guide

## What is CardForge?

CardForge is a multi-tenant e-business card platform. Your company gets its own workspace where you can create professional digital business cards, share them as contacts (VCF), and export them as images or PDFs.

---

## Getting Started

### Register Your Company

1. Go to `http://localhost:3000` (or your deployed URL)
2. Click **Register your company**
3. Fill in:
   - Your name and email
   - A strong password
   - Your **Company name** (e.g. "Acme Corp")
   - A **Company slug** — a URL-safe identifier (e.g. "acme-corp", lowercase letters and hyphens only)
4. Click **Create account**

You are automatically signed in as the **Client Admin** of your new company on the **Starter plan** (free).

### Sign In

1. Go to the login page
2. Enter your email and password
3. You will be taken to your dashboard

---

## Dashboard

The dashboard shows:
- Number of cards you have created
- Number of templates available
- Your current subscription tier (Starter / Professional / Enterprise)

Quick links let you create a new card or browse templates.

---

## Managing Users

> Available to: **Client Admin** and above

### Inviting a User

1. Go to **Users** in the sidebar
2. Click **+ Invite User**
3. Enter their email, name, and assign a role
4. They receive a temporary password

### Roles

| Role | Can do |
|---|---|
| Client Admin | Manage users, templates, subscriptions, create/edit all cards |
| Template Manager | Manage templates (if tenant policy allows), create own cards |
| User | Create and manage their own cards only |

### Starter Plan Limit

The Starter plan allows up to **10 active users**. Upgrade to Professional (50) or Enterprise (unlimited) for more.

---

## Templates

Templates are reusable business card designs. A template defines the layout, colors, fonts, and placeholder fields that users fill in when creating their own card.

### Browsing Templates

Go to **Templates** to see all templates available to your company, including global platform templates.

### Creating a Template

> Available based on your company's **template creation policy** — set by your admin.

1. Click **+ New Template**
2. The card editor opens with a blank 3.5" × 2" canvas
3. Design your template (see [Using the Editor](#using-the-editor))
4. Click **Save**, then **Publish** to make it available to all users

### Template Creation Policies

Your Platform Admin can configure who is allowed to create templates:
- **Platform Admin Only** — only the platform operator can create templates
- **Client Admin Only** — your company admin creates templates
- **Template Manager or Above** — users with the Template Manager role can create templates
- **Any User** — all users can create their own templates

---

## Business Cards

### Creating a Card

1. Go to **My Cards**
2. Click **+ New Card**
3. The card editor opens
4. Design your card or start from a template
5. Click **Save**

### Using the Editor

The editor provides a **3.5" × 2" canvas** (standard business card dimensions).

**Toolbar:**
| Button | Action |
|---|---|
| T | Add a text element (double-click to edit text) |
| ▭ | Add a rectangle |
| ○ | Add a circle |
| ↑ | Bring selected object forward one layer |
| ↓ | Send selected object back one layer |
| ↩ | Undo (removes last added object) |
| ✕ | Delete the selected object(s) |

**Working with objects:**
- **Click** to select
- **Drag** to move
- **Corner handles** to resize
- **Double-click text** to edit inline
- **Hold Shift + Click** to select multiple objects

### Publishing a Card

Click **Save** then the card will appear with a **Published** badge after you call the publish action. Published cards can be exported.

---

## Exporting Cards

### VCF (Contact File)

Available on **all plans**.

1. In the card editor, click **VCF (Contact)**
2. A `.vcf` file downloads
3. Open it on any device — iOS and Android will prompt to add the person to your Contacts

### PNG Image

Available on **Professional plan and above**.

1. In the card editor, click **PNG**
2. A high-resolution (3x) PNG image downloads

### PDF

Available on **Professional plan and above**.

1. In the card editor, click **PDF**
2. A print-ready PDF at business card dimensions downloads

> If PNG/PDF buttons appear greyed out with a **Professional+** badge, upgrade your subscription to unlock them.

---

## Subscriptions

Go to **Subscription** in the sidebar to manage your plan.

### Plan Comparison

| Feature | Starter | Professional | Enterprise |
|---|---|---|---|
| **Price** | Free | $29/month | $99/month |
| **Users** | 10 | 50 | Unlimited |
| **Templates** | 3 | 20 | Unlimited |
| **VCF Export** | ✓ | ✓ | ✓ |
| **PNG/PDF Export** | — | ✓ | ✓ |
| **White-label** | — | — | ✓ |

### Upgrading

1. Go to **Subscription**
2. Click **Upgrade** on the plan you want
3. The upgrade is processed immediately (your previous plan is cancelled)

### Billing History

The Subscription page shows all your past and current subscription records with their status and start dates.

---

## FAQ

**Q: Can I have multiple business card designs?**
Yes. You can create as many cards as you like under your account.

**Q: What happens if I exceed my user limit?**
You will see a "Subscription Limit Reached" error when trying to invite new users. Upgrade your plan to add more users.

**Q: Can I use a template created by another user?**
Yes. Published templates are visible to everyone in your company.

**Q: Is my data private from other companies?**
Yes. CardForge uses strict data isolation — users in one company cannot see data belonging to another company.

**Q: How do I change my role?**
Roles can only be changed by a Client Admin or above. Contact your company admin.

**Q: I lost my password — how do I reset it?**
Password reset email is not yet implemented. Contact your company admin to have your account reset.

---

## Getting Help

Contact your company admin or the platform operator for access issues. For feedback or bugs, visit the project repository.
