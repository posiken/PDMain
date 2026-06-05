# Trouble-Call Dispatch — User Guide

A fast, internal lookup tool for finding available technicians by ZIP code and service type.

---

## Table of Contents

1. [The Lookup Screen](#1-the-lookup-screen)
2. [Reading the Results](#2-reading-the-results)
3. [Signing Into the Admin Panel](#3-signing-into-the-admin-panel)
4. [Managing Technicians](#4-managing-technicians)
5. [Technician Fields Explained](#5-technician-fields-explained)
6. [Managing Access Codes](#6-managing-access-codes-master-only)
7. [Backing Up and Restoring Data](#7-backing-up-and-restoring-data)
8. [Disclaimer](#8-disclaimer)
9. [Contact & Support](#9-contact--support)

---

## 1. The Lookup Screen

This is the first screen you see when you open the app. It lets you find available technicians for a given ZIP code.

**Step 1 — Enter the ZIP code**
Type the 5-digit ZIP code of the service location into the large box at the top. The service type buttons will activate once a valid ZIP is entered.

**Step 2 — Select one or more service types**
Tap the service type buttons that apply to your call:

| Button | What it covers |
|---|---|
| **GHP** | General Household Pest |
| **Lawn** | Lawn & Outdoor services |
| **Termite** | Termite control |
| **Supervisor** | Lead technicians and area supervisors |

You can select **more than one** at a time. For example, selecting both **GHP** and **Supervisor** will show only technicians who are tagged for both. Tap a selected button again to deselect it. Use the **Clear** link to deselect all.

**Step 3 — View results**
Results appear automatically. They are sorted by availability — Available technicians appear first, followed by On Call, In Training, and Off Duty.

---

## 2. Reading the Results

Each result card shows the following information:

**Status badge** — shown next to the technician's name:

| Badge | Meaning |
|---|---|
| 🟢 Available | Ready to take a call |
| 🟡 On Call | Currently on a job |
| 🔵 In Training | Limited availability — check before scheduling |
| 🔴 Off Duty | Not available |

**Branch** — the technician's home branch is displayed in small text next to their name (e.g. Jax N, Tampa, Orlando).

**Service type badges** — show which service types the technician is qualified for. The types that matched your search are highlighted in color.

**Phone number** — tap the phone number directly on a mobile device to call the technician.

**ZIP code** — shows the matched ZIP code. If the technician covers additional ZIP codes, a **+N more** tag indicates how many.

> ⚠️ **Always follow standard procedures.** All scheduling decisions remain subject to established drive times, technician duties, and standard operating procedures. When uncertain about the appropriate assignment, consult a router or supervisor before scheduling.

---

## 3. Signing Into the Admin Panel

Tap **Manage Techs** in the top-right corner of the screen. You will be prompted to enter your access code.

There are two levels of access:

- **Master** — full access, including the ability to manage access codes. There is only one master code.
- **Manager** — can add, edit, and delete technicians. Cannot view or change access codes.

If this is the very first time the admin panel has been opened, you will be asked to create the master code. Choose something secure and write it down somewhere safe — there is no password recovery.

Once signed in, your session remains active until you tap **Sign Out** or close/refresh the page.

---

## 4. Managing Technicians

Once signed in, you will see the **Technicians** tab with a table of all technicians in the system.

### Adding a Technician

1. Tap **+ Add Technician** in the top-right corner
2. Fill in the fields (see [section 5](#5-technician-fields-explained) for details)
3. Tap **Add Technician** to save

> The app will warn you if a technician with the same name already exists, preventing accidental duplicates.

### Editing a Technician

1. Find the technician in the table
2. Tap **Edit** on their row
3. Make your changes
4. Tap **Save Changes**

### Deleting a Technician

1. Find the technician in the table
2. Tap **Delete** on their row
3. A **Confirm?** button will appear — tap it within 3 seconds to confirm the deletion

> Deletion is permanent. If you accidentally delete a technician, you will need to re-add them manually (or restore from a backup — see [section 7](#7-backing-up-and-restoring-data)).

---

## 5. Technician Fields Explained

| Field | Required | Description |
|---|---|---|
| **Full Name** | ✅ | The technician's full name as it should appear in results |
| **Phone Number** | ✅ | Auto-formats to (000) 000-0000 as you type |
| **Status** | ✅ | Current availability: Available, On Call, In Training, or Off Duty |
| **Branch** | — | The technician's home branch location |
| **Service Types** | ✅ | One or more types the technician is qualified for (GHP, Lawn, Termite, Supervisor) |
| **Service ZIP Codes** | — | All ZIP codes this technician is available to service. Type a ZIP and press **Add** (or hit Enter). Tap **×** on any ZIP tag to remove it. |
| **Notes / Specialties** | — | Any additional information (e.g. "Commercial accounts only", "Termite re-inspections") |

---

## 6. Managing Access Codes (Master Only)

Access codes are managed from the **🔐 Access Codes** tab, which is only visible to the master account holder.

### Changing the Master Code

1. Tap **🔐 Access Codes**
2. Under **Master Code**, tap **Change**
3. Enter and confirm your new code
4. Tap **Save New Code**

> After changing the master code, you will need to use the new code the next time you sign in.

### Adding a Manager Code

1. Tap **🔐 Access Codes**
2. Under **Manager Codes**, tap **+ Add Code**
3. Enter a label (e.g. the manager's name) and a code
4. Tap **Add Code**

Share the code privately with the relevant manager. They can use it to sign in and manage technicians, but they will not be able to see or change any access codes.

### Removing a Manager Code

1. Find the manager code in the table
2. Tap **Delete**, then **Confirm?**

That manager will no longer be able to sign in with that code.

---

## 7. Backing Up and Restoring Data

All technician data is stored in a shared cloud database, so it is accessible from any device. However, it is good practice to keep a backup file in case data needs to be restored.

### Exporting (Creating a Backup)

1. Sign into the Admin Panel
2. Make sure you are on the **Technicians** tab
3. Tap **↓ Export**
4. A file named `pestdispatch-YYYY-MM-DD.json` will download to your device
5. Save this file somewhere safe (email it to yourself, save to Google Drive, etc.)

> Tip: Export a fresh backup any time you make significant changes to the technician list.

### Importing (Restoring from Backup)

1. Sign into the Admin Panel
2. Make sure you are on the **Technicians** tab
3. Tap **↑ Import**
4. Select your backup `.json` file
5. A confirmation banner will appear showing how many technicians were found in the file
6. Tap **Yes, Replace All** to restore

> ⚠️ Importing replaces the entire current technician list. Make sure you are importing the correct file before confirming.

> Note: Access codes are **not** included in export files. This is intentional — codes are kept separate for security. If you need to move to a new system, access codes will need to be set up fresh.

---

## 8. Disclaimer

All scheduling decisions made through this tool remain subject to established drive times, technician duties, and standard operating procedures. When uncertain about the appropriate technician assignment, consult a router or supervisor prior to scheduling.

This is an independently developed internal tool and is not an official product of Turner Pest Control. It is privately maintained outside of company business hours.

---

## 9. Contact & Support

For questions, requests, or to report an issue:

**Brett Wingert**
📞 (239) 689-9888
✉️ bmwco89@gmail.com

*Designed and built by Brett Wingert. All application designs and functionality are the property of Brett Wingert. Misuse of any of this application's features will result in application access being revoked.*
