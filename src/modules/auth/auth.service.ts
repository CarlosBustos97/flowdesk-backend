import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Redis } from "ioredis";
import crypto from "node:crypto";
import type { LoginResponse } from "./auth.types.js";
import { AppError } from "../../common/errors/app-error.js";


export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  async login(
    email: string,
    password: string,
    organizationSlug: string,
  ): Promise<LoginResponse> {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (!organization) throw new AppError(401, "Invalid credentials");

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        organizationId: organization.id,
        status: "ACTIVE",
      },
    });

    if (!user) throw new AppError(401, "Invalid credentials");

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) throw new AppError(401, "Invalid credentials");

    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.delete({
      where: {
        id: sessionId,
      },
    });
  }
}
