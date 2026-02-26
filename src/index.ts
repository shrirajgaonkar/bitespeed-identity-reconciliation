import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.send("Bitespeed Identity Reconciliation API Running 🚀");
});

app.post("/identify", async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body as {
    email?: string;
    phoneNumber?: string;
  };

  if (!email && !phoneNumber) {
    return res.status(400).json({
      message: "At least one of email or phoneNumber is required",
    });
  }

  try {
    const matchedContacts = await prisma.contact.findMany({
      where: {
        OR: [
          email ? { email } : undefined,
          phoneNumber ? { phoneNumber } : undefined,
        ].filter(Boolean) as any,
      },
      orderBy: { createdAt: "asc" },
    });

    // Create PRIMARY if no match
    if (matchedContacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "PRIMARY",
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

    const relatedContacts = await prisma.contact.findMany({
      where: {
        OR: [
          ...matchedContacts.map((c: { id: number }) => ({ id: c.id })),
          ...matchedContacts.map((c: { id: number }) => ({
            linkedId: c.id,
          })),
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    let primaryContact =
      relatedContacts.find(
        (c: { linkPrecedence: string }) =>
          c.linkPrecedence === "PRIMARY"
      ) || relatedContacts[0];

    const allPrimaries = relatedContacts.filter(
      (c: { linkPrecedence: string }) =>
        c.linkPrecedence === "PRIMARY"
    );

    if (allPrimaries.length > 1) {
      primaryContact = allPrimaries.sort(
        (a: { createdAt: Date }, b: { createdAt: Date }) =>
          a.createdAt.getTime() - b.createdAt.getTime()
      )[0];

      const otherPrimaries = allPrimaries.filter(
        (p: { id: number }) => p.id !== primaryContact.id
      );

      for (const p of otherPrimaries) {
        await prisma.contact.update({
          where: { id: p.id },
          data: {
            linkPrecedence: "SECONDARY",
            linkedId: primaryContact.id,
          },
        });
      }
    }

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

    finalContacts.forEach((contact: {
      email: string | null;
      phoneNumber: string | null;
    }) => {
      if (contact.email) emails.add(contact.email);
      if (contact.phoneNumber) phoneNumbers.add(contact.phoneNumber);
    });

    const isNewEmail = email && !emails.has(email);
    const isNewPhone = phoneNumber && !phoneNumbers.has(phoneNumber);

    if (isNewEmail || isNewPhone) {
      await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkedId: primaryContact.id,
          linkPrecedence: "SECONDARY",
        },
      });

      if (email) emails.add(email);
      if (phoneNumber) phoneNumbers.add(phoneNumber);
    }

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
      .filter((c: { linkPrecedence: string }) =>
        c.linkPrecedence === "SECONDARY"
      )
      .map((c: { id: number }) => c.id);

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});