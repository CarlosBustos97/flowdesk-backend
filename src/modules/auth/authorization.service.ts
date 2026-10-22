import type { PrismaClient, Role } from "@prisma/client";

import type { PermissionCode } from "../../common/auth/permissions.js";
import { AUTH_SCOPES, type AuthScope } from "../../common/auth/auth-scope.js";
import { isOrganizationBound } from "../../common/auth/request-scope.js";
import { AppError } from "../../common/errors/app-error.js";

export default class AuthorizationService {
  constructor(private readonly prisma: PrismaClient) {}

  async getScope(userId: string): Promise<AuthScope> {
    if (isOrganizationBound()) return AUTH_SCOPES.ORGANIZATION;

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        roles: {
          select: {
            role: {
              select: {
                name: true,
                organizationId: true,
                isGlobal: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(401, "User not found");
    }

    const hasGlobalRole = user.roles.some(
      ({ role }) => role.organizationId === null && role.isGlobal === true,
    );

    if (hasGlobalRole) {
      return AUTH_SCOPES.GLOBAL;
    }

    return AUTH_SCOPES.ORGANIZATION;
  }

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
                  isGlobal: true,
                },
                {
                  organizationId,
                  isGlobal: false,
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

  async canAssignRole(
    requesterUserId: string,
    requesterOrganizationId: string,
    targetRole: Role,
  ): Promise<boolean> {
    const requester = await this.prisma.user.findUnique({
      where: {
        id: requesterUserId,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!requester) {
      return false;
    }

    const requesterIsOwner = requester.roles.some(
      ({ role }) =>
        role.organizationId === null && role.isGlobal && role.name === "OWNER",
    );

    if (requesterIsOwner) {
      return true;
    }

    const requesterIsAdmin = requester.roles.some(
      ({ role }) =>
        !role.isGlobal &&
        role.organizationId === requesterOrganizationId &&
        role.name === "ADMIN",
    );

    if (requesterIsAdmin) {
      return (
        !targetRole.isGlobal &&
        targetRole.organizationId === requesterOrganizationId &&
        targetRole.name !== "OWNER"
      );
    }

    return false;
  }

  async canDisableUser(
    requesterUserId: string,
    requesterOrganizationId: string,
    targetUserId: string,
  ): Promise<boolean> {
    if (requesterUserId === targetUserId) {
      return false;
    }

    const requester = await this.prisma.user.findUnique({
      where: {
        id: requesterUserId,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!requester) {
      return false;
    }

    const targetUser = await this.prisma.user.findUnique({
      where: {
        id: targetUserId,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!targetUser) {
      return false;
    }

    const requesterIsOwner = requester.roles.some(
      ({ role }) =>
        role.organizationId === null && role.isGlobal && role.name === "OWNER",
    );

    const requesterIsAdmin = requester.roles.some(
      ({ role }) =>
        !role.isGlobal &&
        role.organizationId === requesterOrganizationId &&
        role.name === "ADMIN",
    );

    const targetIsOwner = targetUser.roles.some(
      ({ role }) =>
        role.organizationId === null && role.isGlobal && role.name === "OWNER",
    );

    const targetIsAdmin = targetUser.roles.some(
      ({ role }) =>
        !role.isGlobal &&
        role.organizationId === targetUser.organizationId &&
        role.name === "ADMIN",
    );

    /*
     * OWNER
     */
    if (targetIsOwner) {
      return requesterIsOwner;
    }

    /*
     * ADMIN
     */
    if (targetIsAdmin) {
      return requesterIsOwner;
    }

    /*
     * AGENT / USER
     */
    if (requesterIsOwner) {
      return true;
    }

    if (requesterIsAdmin) {
      return targetUser.organizationId === requesterOrganizationId;
    }

    return false;
  }

  async canAccessInternalComments(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const roles = await this.prisma.role.findMany({
      where: {
        users: {
          some: {
            userId,
          },
        },
        OR: [
          {
            name: "OWNER",
            isGlobal: true,
            organizationId: null,
          },
          {
            name: {
              in: ["ADMIN", "MANAGER", "AGENT"],
            },
            isGlobal: false,
            organizationId,
          },
        ],
      },
      select: {
        name: true,
      },
    });

    return roles.length > 0;
  }
}
