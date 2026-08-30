import type { PrismaClient } from "@prisma/client";

import type { PermissionCode } from "../../common/auth/permissions.js";

export default class AuthorizationService {
  constructor(private readonly prisma: PrismaClient) {}

  async hasPermission(
    userId: string,
    organizationId: string,
    permissionCode: PermissionCode,
  ): Promise<boolean> {
    const permission = await this.prisma.permission.findFirst({
      where: {
        code: permissionCode,

        roles: {
          some: {
            role: {
              OR: [
                {
                  organizationId: null,
                },
                {
                  organizationId,
                },
              ],

              users: {
                some: {
                  userId,
                },
              },
            },
          },
        },
      },
    });

    return permission !== null;
  }
}
