import {
  NotificationType,
  TicketStatus,
  type PrismaClient,
} from "@prisma/client";
import type AuthorizationService from "../auth/authorization.service.js";
import type {
  CommentCreateBody,
  CommentCreateParams,
  CommentListParams,
  CommentListQuery,
  CommentUpdateBody,
} from "./comment.types.js";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  calculateElapsedTime,
  evaluateEffectiveSlaStatus,
} from "../sla-policies/sla-policy.calculator.js";
import { calculateElapsedWorkTime } from "../sla-policies/sla-business-hours.calculator.js";
import type { NotificationService } from "../notifications/notification.service.js";

export class CommentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    ticketId: string,
    data: CommentCreateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Veririfcar que el ticket exista
     */
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!ticket) throw new AppError(404, "Ticket not found");

    /**
     * 2. Verificar que el ticket no este cerrado
     */
    if (ticket.status === TicketStatus.CLOSED)
      throw new AppError(
        409,
        "The ticket is closed and cannot receive new comments",
      );

    /**
     * 3. Verificar si el comentario es interno y el usuario tiene permiso par hacerlo
     */
    if (
      data.isInternal &&
      !(await this.authorizationService.canAccessInternalComments(
        requesterUserId,
        ticket.organizationId,
      ))
    )
      throw new AppError(
        403,
        "The user does not have permission to post an internal comment",
      );

    /**
     * 4. Obtener los IDs de los usuarios que recibirán la notificación
     */
    const recipientIds = [ticket.createdById, ticket.assignedToId].filter(
      (userId): userId is string =>
        userId !== null && userId !== requesterUserId,
    );

    const uniqueRecipientIds = [...new Set(recipientIds)];

    const recipients = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueRecipientIds },
        organizationId: ticket.organizationId,
      },
      select: {
        id: true,
      },
    });

    let recipientsIds = recipients.map((user) => user.id);

    if (data.isInternal) {
      const authorizedRecipients = await Promise.all(
        recipientIds.map(async (userId) => ({
          userId,
          allowed: await this.authorizationService.canAccessInternalComments(
            userId,
            ticket.organizationId,
          ),
        })),
      );

      recipientsIds = authorizedRecipients
        .filter((recipient) => recipient.allowed)
        .map((recipient) => recipient.userId);
    }

    /**
     * 5. Crear el comentario
     */
    const comment = await this.prisma.$transaction(async (tx) => {
      const createdComment = await tx.comment.create({
        data: {
          organizationId: ticket.organizationId,
          ticketId: ticket.id,
          userId: requesterUserId,
          content: data.content,
          isInternal: data.isInternal ?? false,
          createdAt: new Date(),
        },
        select: {
          id: true,
          ticketId: true,
          userId: true,
          content: true,
          isInternal: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      /**
       * 6. Enviar notificación a los usuarios que recibirán la notificación
       */
      for (const userId of recipientsIds) {
        await this.notificationService.create(
          {
            organizationId: ticket.organizationId,
            userId,
            type: NotificationType.COMMENT_ADDED,
            title: createdComment.isInternal
              ? "Nota interna"
              : "Nuevo comentario",
            message: createdComment.isInternal
              ? `Se ha añadido una nota interna en el ticket ${ticket.subject}.`
              : `Hay un nuevo comentario en el ticket ${ticket.subject}.`,
            entityType: "ticket",
            entityId: ticket.id,
          },
          tx,
        );
      }

      /**
       * 7. Registrar primera respuesta del SLA
       *
       * Los comentarios internos no cuentan como respuesta al cliente.
       */
      if (createdComment.isInternal) return createdComment;

      const ticketSla = await tx.ticketSla.findUnique({
        where: { ticketId: ticket.id },
        select: {
          id: true,
          firstResponseAt: true,
          firstResponseDueAt: true,
          ticketSlaPauses: {
            select: {
              startedAt: true,
              endedAt: true,
            },
          },
          slaPolicy: {
            select: {
              firstResponseMinutes: true,
              slaCalendar: {
                select: {
                  timezone: true,
                  businessHours: {
                    select: { dayOfWeek: true, startTime: true, endTime: true },
                  },
                  holidays: {
                    select: { date: true },
                  },
                },
              },
            },
          },
          ticket: {
            select: {
              openedAt: true,
            },
          },
        },
      });

      if (
        ticketSla &&
        ticketSla.firstResponseAt === null &&
        ticketSla.firstResponseDueAt
      ) {
        const effectiveElapsed = calculateElapsedWorkTime(
          ticketSla.ticket.openedAt,
          createdComment.createdAt,
          ticketSla.ticketSlaPauses,
          ticketSla.slaPolicy.slaCalendar.businessHours,
          ticketSla.slaPolicy.slaCalendar.holidays,
          ticketSla.slaPolicy.slaCalendar.timezone,
        );

        const firstResponseStatus = evaluateEffectiveSlaStatus(
          effectiveElapsed,
          ticketSla.slaPolicy.firstResponseMinutes,
        );

        const updatedSla = await tx.ticketSla.updateMany({
          where: {
            id: ticketSla.id,
            firstResponseAt: null,
          },
          data: {
            firstResponseAt: createdComment.createdAt,
            firstResponseStatus,
          },
        });

        /**
         * Solo actualizamos Ticket si esta operación
         * fue realmente la primera respuesta.
         */
        if (updatedSla.count === 1) {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              firstResponseAt: createdComment.createdAt,
            },
          });
        }
      }

      return createdComment;
    });

    return comment;
  }

  async list(
    ticketId: string,
    query: CommentListQuery,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const scope = await this.authorizationService.getScope(requesterUserId);

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!ticket) throw new AppError(404, "Ticket not found");

    const canAccessInternalComments =
      await this.authorizationService.canAccessInternalComments(
        requesterUserId,
        ticket.organizationId,
      );

    const where = {
      ticketId: ticket.id,
      deletedAt: null,
      ...(canAccessInternalComments ? {} : { isInternal: false }),
    };

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          ticketId: true,
          userId: true,
          content: true,
          isInternal: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(
    commentId: string,
    data: CommentUpdateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que exista el comentario
     */
    const existingComment = await this.prisma.comment.findFirst({
      where: {
        id: commentId,
        deletedAt: null,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
      include: { ticket: true },
    });

    if (!existingComment) throw new AppError(404, "Comment not found");

    /**
     * 2. Verificar que el ticket no este cerrado
     */
    if (existingComment.ticket.status === TicketStatus.CLOSED)
      throw new AppError(
        409,
        "The ticket is closed and does not allow editing comments",
      );

    /**
     * 4. Verificar quién puede modificar este comentario.
     *
     *    OWNER / ADMIN / MANAGER:
     *    pueden editar cualquier comentario.
     *
     *    AGENT:
     *    solamente sus propios comentarios.
     */
    const canEditAll = await this.canManageAllComments(
      requesterUserId,
      existingComment.organizationId,
    );

    if (!canEditAll && existingComment.userId !== requesterUserId)
      throw new AppError(403, "The user cannot modify this comment");

    /**
     * 5. Actualizar el contenido del comenmtario
     */
    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: data.content ?? existingComment.content,
      },
      select: {
        id: true,
        ticketId: true,
        userId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return comment;
  }

  async delete(
    commentId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el comentario exista
     */
    const existingComment = await this.prisma.comment.findFirst({
      where: {
        id: commentId,
        deletedAt: null,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
      include: { ticket: true },
    });

    if (!existingComment) throw new AppError(404, "Comment not found");

    /**
     * 2. Verificar que el ticket no este cerrado
     */
    if (existingComment.ticket.status === TicketStatus.CLOSED)
      throw new AppError(
        409,
        "The ticket is closed and does not allow deleting comments",
      );

    /**
     * 4. Verificar quién puede eliminar este comentario.
     *
     *    OWNER / ADMIN / MANAGER:
     *    pueden eliminar cualquier comentario.
     *
     *    AGENT:
     *    solamente sus propios comentarios.
     */
    const canDeleteAll = await this.canManageAllComments(
      requesterUserId,
      existingComment.organizationId,
    );

    if (!canDeleteAll && existingComment.userId !== requesterUserId)
      throw new AppError(403, "The user cannot delete this comment");

    /**
     * 5. Eliminar el comentario
     */
    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
      },
      select: {
        id: true,
        ticketId: true,
        userId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return comment;
  }

  private async canManageAllComments(userId: string, organizationId: string) {
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
              in: ["ADMIN", "MANAGER"],
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
