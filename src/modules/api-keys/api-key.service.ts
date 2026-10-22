import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { hashSecret } from "../../common/auth/hash-secret.js";
import { PERMISSIONS, type PermissionCode } from "../../common/auth/permissions.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AuditLogService } from "../audit-logs/audit-log.service.js";
import type AuthorizationService from "../auth/authorization.service.js";
import type {
  ApiKeyCreateBody,
  ApiKeyListQuery,
} from "./api-key.types.js";

const KNOWN_SCOPES = new Set<string>(Object.values(PERMISSIONS));

const publicSelect = {
  id: true,
  name: true,
  keyPrefix: true,
  scopes: true,
  expiresAt: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
  organization: { select: { id: true, name: true, slug: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ApiKeySelect;

export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(
    query: ApiKeyListQuery,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const scope = await this.authorizationService.getScope(requesterUserId);
    const where = {
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
    };

    const [apiKeys, total] = await this.prisma.$transaction([
      this.prisma.apiKey.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: publicSelect,
      }),
      this.prisma.apiKey.count({ where }),
    ]);

    return {
      apiKeys,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(
    data: ApiKeyCreateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    if (
      scope === AUTH_SCOPES.ORGANIZATION &&
      data.organizationId !== requesterOrganizationId
    ) {
      throw new AppError(
        403,
        "You do not have permission to create an API key for this organization",
      );
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: data.organizationId },
      select: { id: true },
    });

    if (!organization) throw new AppError(404, "Organization not found");

    const scopes = uniqueScopes(data.scopes);
    this.assertKnownScopes(scopes);
    await this.assertGrantable(scopes, requesterUserId, data.organizationId);

    const expiresAt = parseExpiry(data.expiresAt);
    const secret = `fdk_${crypto.randomBytes(32).toString("base64url")}`;
    const keyPrefix = secret.slice(0, 12);

    const apiKey = await this.prisma.$transaction(async (tx) => {
      const created = await tx.apiKey.create({
        data: {
          organizationId: data.organizationId,
          name: data.name.trim(),
          keyPrefix,
          keyHash: hashSecret(secret),
          scopes,
          ...(expiresAt ? { expiresAt } : {}),
          createdById: requesterUserId,
        },
        select: publicSelect,
      });

      await this.auditLogService.record(
        {
          organizationId: data.organizationId,
          userId: requesterUserId,
          action: "api_key.created",
          entityType: "api_key",
          entityId: created.id,
          newValues: {
            name: created.name,
            keyPrefix: created.keyPrefix,
            scopes,
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
          },
        },
        tx,
      );

      return created;
    });

    return {
      ...apiKey,
      secret,
    };
  }

  async revoke(
    apiKeyId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);
    const existing = await this.prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
      select: {
        id: true,
        organizationId: true,
        revokedAt: true,
      },
    });

    if (!existing) throw new AppError(404, "API key not found");
    if (existing.revokedAt) throw new AppError(409, "API key is already revoked");

    const revokedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const apiKey = await tx.apiKey.update({
        where: { id: existing.id },
        data: { revokedAt },
        select: publicSelect,
      });

      await this.auditLogService.record(
        {
          organizationId: existing.organizationId,
          userId: requesterUserId,
          action: "api_key.revoked",
          entityType: "api_key",
          entityId: existing.id,
          newValues: {
            revokedAt: revokedAt.toISOString(),
          },
        },
        tx,
      );

      return apiKey;
    });
  }

  private assertKnownScopes(scopes: string[]) {
    for (const scope of scopes) {
      if (!KNOWN_SCOPES.has(scope)) {
        throw new AppError(400, "API key scope is not supported");
      }
    }
  }

  private async assertGrantable(
    scopes: string[],
    requesterUserId: string,
    organizationId: string,
  ) {
    for (const scope of scopes) {
      const allowed = await this.authorizationService.hasPermission(
        requesterUserId,
        organizationId,
        scope as PermissionCode,
      );

      if (!allowed) {
        throw new AppError(
          403,
          "You cannot grant a permission you do not have",
        );
      }
    }
  }
}

function uniqueScopes(scopes: string[]) {
  return [...new Set(scopes.map((scope) => scope.trim()))];
}

function parseExpiry(value: string | undefined) {
  if (value === undefined) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "API key expiration is invalid");
  }

  if (date.getTime() <= Date.now()) {
    throw new AppError(400, "API key expiration must be in the future");
  }

  return date;
}
