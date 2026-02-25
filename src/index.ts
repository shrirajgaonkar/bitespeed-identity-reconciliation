import express, { Request, Response } from "express";
import { PrismaClient, Contact } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.send("Bitespeed Identity Reconciliation API Running 🚀");
});

app.post("/identify", async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({
      message: "At least one of email or phoneNumber is required",
    });
  }

  try {
    // 1️⃣ Find contacts matching email OR phone
    const matchedContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { email: email ?? undefined },
          { phoneNumber: phoneNumber ?? undefined },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // 2️⃣ If no match → create new primary
    if (matchedContacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary",
        },
      });

      return res.status(200).json({
        contact: {
          primaryContactId: newContact.id,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    // 3️⃣ Collect related contacts
    const relatedContacts = await prisma.contact.findMany({
      where: {
        OR: [
          ...matchedContacts.map((c) => ({ id: c.id })),
          ...matchedContacts.map((c) => ({ linkedId: c.id })),
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // 4️⃣ Determine oldest primary
    let primaryContact: Contact =
      relatedContacts.find((c) => c.linkPrecedence === "primary") ||
      relatedContacts[0];

    const allPrimaries = relatedContacts.filter(
      (c) => c.linkPrecedence === "primary"
    );

    if (allPrimaries.length > 1) {
      primaryContact = allPrimaries.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      )[0];

      const otherPrimaries = allPrimaries.filter(
        (p) => p.id !== primaryContact.id
      );

      for (const p of otherPrimaries) {
        await prisma.contact.update({
          where: { id: p.id },
          data: {
            linkPrecedence: "secondary",
            linkedId: primaryContact.id,
          },
        });
      }
    }

    // 5️⃣ Fetch final contacts
    const finalContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { id: primaryContact.id },
          { linkedId: primaryContact.id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    const emails = new Set<string>();
    const phoneNumbers = new Set<string>();

    finalContacts.forEach((contact) => {
      if (contact.email) emails.add(contact.email);
      if (contact.phoneNumber) phoneNumbers.add(contact.phoneNumber);
    });

    // 6️⃣ Create secondary if new info
    const isNewEmail = email && !emails.has(email);
    const isNewPhone = phoneNumber && !phoneNumbers.has(phoneNumber);

    if (isNewEmail || isNewPhone) {
      await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkedId: primaryContact.id,
          linkPrecedence: "secondary",
        },
      });

      if (email) emails.add(email);
      if (phoneNumber) phoneNumbers.add(phoneNumber);
    }

    // 7️⃣ Fetch updated contacts
    const updatedContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { id: primaryContact.id },
          { linkedId: primaryContact.id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    const secondaryContactIds = updatedContacts
      .filter((c) => c.linkPrecedence === "secondary")
      .map((c) => c.id);

    return res.status(200).json({
      contact: {
        primaryContactId: primaryContact.id,
        emails: Array.from(emails),
        phoneNumbers: Array.from(phoneNumbers),
        secondaryContactIds,
      },
    });
  } catch (error) {
    console.error("Error in /identify:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// ✅ Render-compatible PORT
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});