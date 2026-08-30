import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const permissions = [
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
    description: "Create new users",
    module: "users",
  },
  {
    code: "users.update",
    name: "Update users",
    description: "Update existing users",
    module: "users",
  },
  {
    code: "users.delete",
    name: "Delete users",
    description: "Delete users",
    module: "users",
  },

  // Organizations
  {
    code: "organizations.view",
    name: "View organization",
    description: "View organization information",
    module: "organizations",
  },
  {
    code: "organizations.update",
    name: "Update organization",
    description: "Update organization information",
    module: "organizations",
  },

  // Customers
  {
    code: "customers.view",
    name: "View customers",
    description: "View customers",
    module: "customers",
  },
  {
    code: "customers.create",
    name: "Create customers",
    description: "Create new customers",
    module: "customers",
  },
  {
    code: "customers.update",
    name: "Update customers",
    description: "Update existing customers",
    module: "customers",
  },
  {
    code: "customers.delete",
    name: "Delete customers",
    description: "Delete customers",
    module: "customers",
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
    description: "Create new projects",
    module: "projects",
  },
  {
    code: "projects.update",
    name: "Update projects",
    description: "Update existing projects",
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
    description: "Create new tasks",
    module: "tasks",
  },
  {
    code: "tasks.update",
    name: "Update tasks",
    description: "Update existing tasks",
    module: "tasks",
  },
  {
    code: "tasks.assign",
    name: "Assign tasks",
    description: "Assign tasks to users",
    module: "tasks",
  },
  {
    code: "tasks.delete",
    name: "Delete tasks",
    description: "Delete tasks",
    module: "tasks",
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
    description: "Create new tickets",
    module: "tickets",
  },
  {
    code: "tickets.update",
    name: "Update tickets",
    description: "Update existing tickets",
    module: "tickets",
  },
  {
    code: "tickets.assign",
    name: "Assign tickets",
    description: "Assign tickets to users",
    module: "tickets",
  },
  {
    code: "tickets.resolve",
    name: "Resolve tickets",
    description: "Resolve tickets",
    module: "tickets",
  },
  {
    code: "tickets.delete",
    name: "Delete tickets",
    description: "Delete tickets",
    module: "tickets",
  },

  // Reports
  {
    code: "reports.view",
    name: "View reports",
    description: "View reports",
    module: "reports",
  },
  {
    code: "reports.create",
    name: "Create reports",
    description: "Generate reports",
    module: "reports",
  },

  // Workflows
  {
    code: "workflows.view",
    name: "View workflows",
    description: "View workflows",
    module: "workflows",
  },
  {
    code: "workflows.create",
    name: "Create workflows",
    description: "Create workflows",
    module: "workflows",
  },
  {
    code: "workflows.update",
    name: "Update workflows",
    description: "Update workflows",
    module: "workflows",
  },
  {
    code: "workflows.delete",
    name: "Delete workflows",
    description: "Delete workflows",
    module: "workflows",
  },
];

const roles = [
  {
    name: "OWNER",
    description: "Organization owner with full access",
  },
  {
    name: "ADMIN",
    description: "Organization administrator",
  },
  {
    name: "MANAGER",
    description: "Manager with operational permissions",
  },
  {
    name: "AGENT",
    description: "Support agent responsible for tickets",
  },
  {
    name: "USER",
    description: "Standard organization user",
  },
];

const rolePermissions: Record<string, string[]> = {
  OWNER: permissions.map((permission) => permission.code),

  ADMIN: permissions
    .filter((permission) => permission.code !== "organizations.update")
    .map((permission) => permission.code),

  MANAGER: [
    "users.view",
    "customers.view",
    "customers.create",
    "customers.update",
    "projects.view",
    "projects.create",
    "projects.update",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.assign",
    "tickets.view",
    "tickets.create",
    "tickets.update",
    "tickets.assign",
    "tickets.resolve",
    "reports.view",
    "reports.create",
  ],

  AGENT: [
    "customers.view",
    "projects.view",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tickets.view",
    "tickets.create",
    "tickets.update",
    "tickets.resolve",
  ],

  USER: [
    "customers.view",
    "projects.view",
    "tasks.view",
    "tickets.view",
    "tickets.create",
  ],
};

async function main() {
  console.log("🌱 Starting FlowDesk seed...");

  const password = process.env.SEED_DEFAULT_PASSWORD ?? "FlowDesk123!";

  const passwordHash = await bcrypt.hash(password, 12);

  /*
   * Organization
   */
  const organization = await prisma.organization.upsert({
    where: {
      slug: "acme-corporation",
    },
    update: {},
    create: {
      name: "Acme Corporation",
      slug: "acme-corporation",
      email: "admin@acme.test",
      phone: "+1 555 0100",
      timezone: "UTC",
    },
  });

  console.log(`✓ Organization: ${organization.name}`);

  /*
   * Permissions
   */
  const permissionMap = new Map<string, string>();

  for (const permission of permissions) {
    const record = await prisma.permission.upsert({
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

    permissionMap.set(record.code, record.id);
  }

  console.log(`✓ Permissions: ${permissions.length}`);

  /*
   * Roles
   */
  const roleMap = new Map<string, string>();

  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: roleData.name,
        },
      },
      update: {
        description: roleData.description,
        isSystem: true,
      },
      create: {
        organizationId: organization.id,
        name: roleData.name,
        description: roleData.description,
        isSystem: true,
      },
    });

    roleMap.set(role.name, role.id);
  }

  console.log(`✓ Roles: ${roles.length}`);

  /*
   * Role permissions
   */
  for (const [roleName, permissionCodes] of Object.entries(rolePermissions)) {
    const roleId = roleMap.get(roleName);

    if (!roleId) {
      throw new Error(`Role not found: ${roleName}`);
    }

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionMap.get(permissionCode);

      if (!permissionId) {
        throw new Error(`Permission not found: ${permissionCode}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }

  console.log("✓ Role permissions configured");

  /*
   * Users
   */
  const users = [
    {
      name: "Acme Administrator",
      email: "admin@acme.test",
      role: "OWNER",
    },
    {
      name: "Acme Manager",
      email: "manager@acme.test",
      role: "MANAGER",
    },
    {
      name: "Acme Agent",
      email: "agent@acme.test",
      role: "AGENT",
    },
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: userData.email,
        },
      },
      update: {
        name: userData.name,
        passwordHash,
        status: "ACTIVE",
      },
      create: {
        organizationId: organization.id,
        name: userData.name,
        email: userData.email,
        passwordHash,
        status: "ACTIVE",
      },
    });

    const roleId = roleMap.get(userData.role);

    if (!roleId) {
      throw new Error(`Role not found: ${userData.role}`);
    }

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId,
      },
    });

    console.log(`✓ User: ${user.email} → ${userData.role}`);
  }

  console.log("");
  console.log("🌱 FlowDesk seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
