import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

interface AdministratorSeed {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  photoUrl: null;
}

const administrators: AdministratorSeed[] = [
  {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    photoUrl: null,
  },
  {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    photoUrl: null,
  },
  {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    photoUrl: null,
  },
];

const validateAdministratorData = (): void => {
  const hasIncompleteData = administrators.some((administrator) =>
    [
      administrator.firstName,
      administrator.lastName,
      administrator.email,
      administrator.password,
      administrator.phone,
    ].some((value) => value.trim().length === 0),
  );

  if (hasIncompleteData) {
    throw new Error(
      "Complete all administrator values in prisma/seed.ts before running the seed.",
    );
  }
};

const seedAdministrators = async (): Promise<void> => {
  validateAdministratorData();

  for (const administrator of administrators) {
    const passwordHash = await bcrypt.hash(
      administrator.password,
      SALT_ROUNDS,
    );

    await prisma.user.upsert({
      where: { email: administrator.email },
      update: {},
      create: {
        firstName: administrator.firstName,
        lastName: administrator.lastName,
        email: administrator.email,
        passwordHash,
        phone: administrator.phone,
        photoUrl: administrator.photoUrl,
        role: Role.ADMIN,
      },
    });
  }
};

const runSeed = async (): Promise<void> => {
  try {
    await seedAdministrators();
    console.log("Administrator seed completed successfully.");
  } catch (error) {
    console.error("Administrator seed failed.", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void runSeed();
