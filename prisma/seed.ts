import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const ORGANIZATION = {
  name: "Acme Corporation",
  slug: "acme-corporation",
  email: "admin@acme.test",
  phone: "+34 600 000 000",
  timezone: "Europe/Madrid",
};

const ROLES = [
  {
    name: "OWNER",
    description: "Full access to the platform",
    isGlobal: true,
  },
  {
    name: "ADMIN",
    description: "Administrative access to the organization",
    isGlobal: false,
  },
  {
    name: "MANAGER",
    description: "Management access to projects, tasks and tickets",
    isGlobal: false,
  },
  {
    name: "AGENT",
    description: "Support agent access to tickets",
    isGlobal: false,
  },
  {
    name: "USER",
    description: "Basic application access",
    isGlobal: false,
  },
];

const PERMISSIONS = [
  // Users
  {
    code: "users.view",
    name: "View users",
    description: "View organization users",
    module: "users",
  },
  {
    code: "users.create",
    name: "Create users",
    description: "Create organization users",
    module: "users",
  },
  {
    code: "users.update",
    name: "Update users",
    description: "Update organization users",
    module: "users",
  },
  {
    code: "users.delete",
    name: "Delete users",
    description: "Delete organization users",
    module: "users",
  },

  // Tickets Categories
  {
    code: "ticket_categories.view",
    name: "View ticket categories",
    description: "View ticket categories",
    module: "tickets",
  },
  {
    code: "ticket_categories.create",
    name: "Create ticket categories",
    description: "Create ticket categories",
    module: "tickets",
  },
  {
    code: "ticket_categories.update",
    name: "Update ticket categories",
    description: "Update ticket categories",
    module: "tickets",
  },
  {
    code: "ticket_categories.delete",
    name: "Delete ticket categories",
    description: "Delete ticket categories",
    module: "tickets",
  },

  // Tickets
  {
    code: "tickets.view",
    name: "View tickets",
    description: "View tickets",
    module: "tickets",
  },
  {
    code: "tickets.create",
    name: "Create tickets",
    description: "Create tickets",
    module: "tickets",
  },
  {
    code: "tickets.update",
    name: "Update tickets",
    description: "Update tickets",
    module: "tickets",
  },
  {
    code: "tickets.assign",
    name: "Assign tickets to agents",
    description: "Assign tickets to agents",
    module: "tickets",
  },
  {
    code: "tickets.resolve",
    name: "Resolve tickets",
    description: "Resolve tickets",
    module: "tickets",
  },
  {
    code: "tickets.close",
    name: "Close tickets",
    description: "Close tickets",
    module: "tickets",
  },

  // Projects
  {
    code: "projects.view",
    name: "View projects",
    description: "View projects",
    module: "projects",
  },
  {
    code: "projects.create",
    name: "Create projects",
    description: "Create projects",
    module: "projects",
  },
  {
    code: "projects.update",
    name: "Update projects",
    description: "Update projects",
    module: "projects",
  },
  {
    code: "projects.delete",
    name: "Delete projects",
    description: "Delete projects",
    module: "projects",
  },

  // Tasks
  {
    code: "tasks.view",
    name: "View tasks",
    description: "View tasks",
    module: "tasks",
  },
  {
    code: "tasks.create",
    name: "Create tasks",
    description: "Create tasks",
    module: "tasks",
  },
  {
    code: "tasks.update",
    name: "Update tasks",
    description: "Update tasks",
    module: "tasks",
  },
  {
    code: "tasks.assign",
    name: "Assign tasks",
    description: "Assign tasks to users",
    module: "tasks",
  },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: PERMISSIONS.map((permission) => permission.code),

  ADMIN: [
    "users.view",
    "users.create",
    "users.update",
    "users.delete",
    "tickets.view",
    "tickets.create",
    "tickets.update",
    "tickets.assign",
    "tickets.resolve",
    "tickets.close",
    "projects.view",
    "projects.create",
    "projects.update",
    "projects.delete",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.assign",
    "ticket_categories.view",
    "ticket_categories.create",
    "ticket_categories.update",
    "ticket_categories.delete",
  ],

  MANAGER: [
    "users.view",
    "tickets.view",
    "tickets.create",
    "tickets.update",
    "tickets.assign",
    "tickets.resolve",
    "tickets.close",
    "projects.view",
    "projects.create",
    "projects.update",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.assign",
    "ticket_categories.view",
    "ticket_categories.create",
    "ticket_categories.update",
    "ticket_categories.delete",
  ],

  AGENT: [
    "tickets.view",
    "tickets.create",
    "tickets.update",
    "tickets.resolve",
    "projects.view",
    "tasks.view",
    "tasks.create",
    "tasks.update",
  ],

  USER: ["tickets.view", "tickets.create", "projects.view", "tasks.view"],
};

const USERS = [
  {
    name: "Acme Admin",
    email: "admin@acme.test",
    password: "Admin123!",
    role: "OWNER",
  },
  {
    name: "Acme Manager",
    email: "manager@acme.test",
    password: "Manager123!",
    role: "MANAGER",
  },
  {
    name: "Acme Agent",
    email: "agent@acme.test",
    password: "Agent123!",
    role: "AGENT",
  },
];

async function main() {
  console.log("🌱 Starting database seed...");

  await prisma.$transaction(async (tx) => {
    /*
     * 1. Organization
     */
    const organization = await tx.organization.upsert({
      where: {
        slug: ORGANIZATION.slug,
      },
      update: {
        name: ORGANIZATION.name,
        email: ORGANIZATION.email,
        phone: ORGANIZATION.phone,
        timezone: ORGANIZATION.timezone,
        status: "ACTIVE",
      },
      create: {
        name: ORGANIZATION.name,
        slug: ORGANIZATION.slug,
        email: ORGANIZATION.email,
        phone: ORGANIZATION.phone,
        timezone: ORGANIZATION.timezone,
        status: "ACTIVE",
      },
    });

    console.log(`✓ Organization: ${organization.name}`);

    /*
     * 2. Permissions
     */
    const permissionMap = new Map<
      string,
      {
        id: string;
        code: string;
      }
    >();

    for (const permission of PERMISSIONS) {
      const record = await tx.permission.upsert({
        where: {
          code: permission.code,
        },
        update: {
          name: permission.name,
          description: permission.description,
          module: permission.module,
        },
        create: permission,
      });

      permissionMap.set(record.code, {
        id: record.id,
        code: record.code,
      });
    }

    console.log(`✓ Permissions: ${PERMISSIONS.length}`);

    /*
     * 3. Roles
     *
     * OWNER and USER are global roles.
     * ADMIN, MANAGER and AGENT belong to the organization.
     */
    const roleMap = new Map<
      string,
      {
        id: string;
        name: string;
      }
    >();

    for (const role of ROLES) {
      let record;

      /*
         * Global role
         *
         * organizationId = role.isGlobal ? null : organization.id
         * isGlobal = role.isGlobal
         */
        record = await tx.role.findFirst({
          where: {
            name: role.name,
          },
        });

        if (record) {
          record = await tx.role.update({
            where: {
              id: record.id,
            },
            data: {
              description: role.description,
              isGlobal: role.isGlobal,
              organizationId: role.isGlobal ? null : organization.id,
            },
          });
        } else {
          record = await tx.role.create({
            data: {
              organizationId: role.isGlobal ? null : organization.id,
              name: role.name,
              description: role.description,
              isGlobal: role.isGlobal,
            },
          });
        }

      roleMap.set(record.name, {
        id: record.id,
        name: record.name,
      });

      console.log(
        `✓ Role: ${record.name} ${
          role.isGlobal ? "(global)" : "(organization)"
        }`,
      );
    }

    /*
     * 4. Role permissions
     */
    for (const [roleName, permissionCodes] of Object.entries(
      ROLE_PERMISSIONS,
    )) {
      const role = roleMap.get(roleName);

      if (!role) {
        throw new Error(`Role not found: ${roleName}`);
      }

      for (const permissionCode of permissionCodes) {
        const permission = permissionMap.get(permissionCode);

        if (!permission) {
          throw new Error(`Permission not found: ${permissionCode}`);
        }

        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }

    console.log("✓ Role permissions assigned");

    /*
     * 5. Users
     */
    for (const user of USERS) {
      const passwordHash = await bcrypt.hash(user.password, 12);

      const record = await tx.user.upsert({
        where: {
          organizationId_email: {
            organizationId: organization.id,
            email: user.email,
          },
        },
        update: {
          name: user.name,
          passwordHash,
          status: "ACTIVE",
        },
        create: {
          organizationId: organization.id,
          name: user.name,
          email: user.email,
          passwordHash,
          status: "ACTIVE",
        },
      });

      console.log(`✓ User: ${record.email}`);

      /*
       * 6. User role
       */
      const role = roleMap.get(user.role);

      if (!role) {
        throw new Error(`Role not found: ${user.role}`);
      }

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: record.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId: record.id,
          roleId: role.id,
        },
      });
    }

    console.log("✓ User roles assigned");
  });

  console.log("🌱 Database seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
