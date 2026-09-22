import { UserStatus, type PrismaClient } from "@prisma/client";

import type {
  UserCreateBody,
  UserListQuery,
  UserUpdateBody,
} from "./user.types.js";

import AuthorizationService from "../auth/authorization.service.js";

import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";
import bcrypt from "bcryptjs";

export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(query: UserListQuery, userId: string, organizationId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const scope = await this.authorizationService.getScope(userId);

    const where = {
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? {
            organizationId,
          }
        : {}),

      ...(query.search
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                email: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      this.prisma.user.count({
        where,
      }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(
    targetUserId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const where = {
      id: targetUserId,

      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? {
            organizationId: requesterOrganizationId,
          }
        : {}),
    };

    const user = await this.prisma.user.findFirst({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return user;
  }

  async create(
    data: UserCreateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /*
     * 1. Determinar la organización donde se creará el usuario.
     */
    let organizationId = data.organizationId;

    if (scope === AUTH_SCOPES.ORGANIZATION) {
      if (data.organizationId !== requesterOrganizationId) {
        throw new AppError(
          403,
          "You cannot create users in another organization",
        );
      }

      organizationId = requesterOrganizationId;
    }

    /*
     * 2. Verificar que la organización exista.
     */
    const organization = await this.prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
    });

    if (!organization) {
      throw new AppError(404, "Organization not found");
    }

    /*
     * 3. Verificar que el email no esté registrado.
     */
    const existingUser = await this.prisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email: data.email,
        },
      },
    });

    if (existingUser) {
      throw new AppError(409, "Email is already registered");
    }

    /*
     * 4. Buscar el rol.
     */
    const role = await this.prisma.role.findUnique({
      where: {
        id: data.roleId,
      },
    });

    if (!role) {
      throw new AppError(404, "Role not found");
    }

    /**
     * 5. Validar que el usuario solicitante pueda asignar el rol al nuevo usuario.
     */

    const canAssignRole = await this.authorizationService.canAssignRole(
      requesterUserId,
      requesterOrganizationId,
      role,
    );

    if (!canAssignRole) {
      throw new AppError(403, "You cannot assign this role");
    }

    /*
     * 6. Validar que el rol pueda utilizarse
     *    dentro de la organización seleccionada.
     */
    if (!role.isGlobal && role.organizationId !== organizationId) {
      throw new AppError(
        403,
        "The selected role does not belong to this organization",
      );
    }

    /*
     * 7. Generar el hash de la contraseña.
     */
    const passwordHash = await bcrypt.hash(data.password, 12);

    /*
     * 8. Crear usuario y relación con el rol.
     */
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        organizationId,

        roles: {
          create: {
            roleId: role.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return user;
  }

  async update(
    targetUserId: string,
    data: UserUpdateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /*
     * 1. Buscar el usuario dentro del alcance permitido.
     */
    const where = {
      id: targetUserId,
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
    };

    const existingUser = await this.prisma.user.findFirst({
      where,
    });

    if (!existingUser) {
      throw new AppError(404, "User not found");
    }

    /*
     * 2. Validar email si viene en la actualización.
     */
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: {
          organizationId: existingUser.organizationId,
          email: data.email,
          NOT: {
            id: existingUser.id,
          },
        },
      });

      if (emailExists) {
        throw new AppError(409, "Email is already registered");
      }
    }

    /*
     * 3. Validar el nuevo rol.
     */
    let newRole = null;

    if (data.roleId) {
      newRole = await this.prisma.role.findUnique({
        where: {
          id: data.roleId,
        },
      });

      if (!newRole) {
        throw new AppError(404, "Role not found");
      }

      const canAssignRole = await this.authorizationService.canAssignRole(
        requesterUserId,
        requesterOrganizationId,
        newRole,
      );

      if (!canAssignRole) {
        throw new AppError(403, "You cannot assign this role");
      }

      if (
        !newRole.isGlobal &&
        newRole.organizationId !== existingUser.organizationId
      ) {
        throw new AppError(
          403,
          "The selected role does not belong to this organization",
        );
      }
    }

    /*
     * 4. Actualizar dentro de una transacción.
     */
    const user = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),

          ...(data.email !== undefined ? { email: data.email } : {}),

          ...(data.status !== undefined ? { status: data.status } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          roles: {
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      /*
       * 5. Cambiar el rol únicamente si
       *    se recibió roleId.
       */
      if (data.roleId) {
        await tx.userRole.deleteMany({
          where: {
            userId: existingUser.id,
          },
        });

        await tx.userRole.create({
          data: {
            userId: existingUser.id,
            roleId: data.roleId,
          },
        });
      }

      return updatedUser;
    });

    return user;
  }

  async disable(
    targetUserId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /*
     * 1. Buscar el usuario dentro del alcance permitido.
     */
    const where = {
      id: targetUserId,
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
    };

    const existingUser = await this.prisma.user.findFirst({
      where,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw new AppError(404, "User not found");
    }

    /*
     * 2. Evitar desactivarse a sí mismo.
     */
    if (existingUser.id === requesterUserId) {
      throw new AppError(403, "You cannot disable yourself");
    }

    /*
     * 3. Si ya está deshabilitado, no hacemos nada.
     */
    if (existingUser.status === UserStatus.INACTIVE) {
      throw new AppError(409, "User is already disabled");
    }

    /*
     * 4. Verificar autorización.
     */
    const canDisable = await this.authorizationService.canDisableUser(
      requesterUserId,
      requesterOrganizationId,
      existingUser.id,
    );

    if (!canDisable) {
      throw new AppError(403, "You cannot disable this user");
    }

    /*
     * 5. Desactivación lógica.
     */
    const user = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          status: UserStatus.INACTIVE,
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          organizationId: true,
          roles: {
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.session.deleteMany({
        where: {
          userId: existingUser.id,
        },
      });

      return updatedUser;
    });

    return user;
  }
}
