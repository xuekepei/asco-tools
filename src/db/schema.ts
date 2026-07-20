import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const user = mysqlTable(
  "user",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: mysqlEnum("role", ["user", "support", "admin"])
      .notNull()
      .default("user"),
    banned: boolean("banned").notNull().default(false),
    banReason: varchar("ban_reason", { length: 255 }),
    banExpires: timestamp("ban_expires"),
    plan: mysqlEnum("plan", ["free", "pro"]).notNull().default("free"),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("user_email_uq").on(table.email),
    uniqueIndex("user_stripe_customer_uq").on(table.stripeCustomerId),
  ],
);

export const session = mysqlTable(
  "session",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    impersonatedBy: varchar("impersonated_by", { length: 36 }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_uq").on(table.token),
    index("session_user_idx").on(table.userId),
  ],
);

export const account = mysqlTable(
  "account",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 100 }).notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("account_user_idx").on(table.userId)],
);

export const verification = mysqlTable(
  "verification",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const renewalDeclaration = mysqlTable(
  "renewal_declaration",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fiscalYear: int("fiscal_year").notNull(),
    businessName: varchar("business_name", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["draft", "completed"])
      .notNull()
      .default("draft"),
    formData: json("form_data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index("renewal_declaration_user_year_idx").on(
      table.userId,
      table.fiscalYear,
    ),
  ],
);

export const exportLog = mysqlTable(
  "export_log",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    declarationId: varchar("declaration_id", { length: 36 }),
    format: mysqlEnum("format", ["xlsx", "pdf"]).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("export_log_user_idx").on(table.userId)],
);

export const adminAuditLog = mysqlTable(
  "admin_audit_log",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    actorUserId: varchar("actor_user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 100 }).notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(),
    targetId: varchar("target_id", { length: 36 }).notNull(),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("admin_audit_actor_idx").on(table.actorUserId),
    index("admin_audit_created_idx").on(table.createdAt),
  ],
);

export const stripeSubscription = mysqlTable(
  "stripe_subscription",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeSubscriptionId: varchar("stripe_subscription_id", {
      length: 255,
    }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    priceId: varchar("price_id", { length: 255 }),
    status: varchar("status", { length: 40 }).notNull(),
    billingInterval: mysqlEnum("billing_interval", ["month", "year"]),
    intervalCount: int("interval_count").notNull().default(1),
    unitAmount: int("unit_amount"),
    currency: varchar("currency", { length: 3 }).notNull().default("jpy"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at"),
    lastEventCreatedAt: timestamp("last_event_created_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("stripe_subscription_stripe_id_uq").on(
      table.stripeSubscriptionId,
    ),
    uniqueIndex("stripe_subscription_user_uq").on(table.userId),
    index("stripe_subscription_status_idx").on(table.status),
  ],
);

export const stripeInvoice = mysqlTable(
  "stripe_invoice",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 36 }).references(() => user.id, {
      onDelete: "set null",
    }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    number: varchar("number", { length: 100 }),
    status: varchar("status", { length: 40 }),
    currency: varchar("currency", { length: 3 }).notNull().default("jpy"),
    subtotal: int("subtotal").notNull().default(0),
    tax: int("tax").notNull().default(0),
    total: int("total").notNull().default(0),
    amountDue: int("amount_due").notNull().default(0),
    amountPaid: int("amount_paid").notNull().default(0),
    amountRemaining: int("amount_remaining").notNull().default(0),
    paymentFailed: boolean("payment_failed").notNull().default(false),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdf: text("invoice_pdf"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    paidAt: timestamp("paid_at"),
    lastEventCreatedAt: timestamp("last_event_created_at").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("stripe_invoice_stripe_id_uq").on(table.stripeInvoiceId),
    index("stripe_invoice_user_idx").on(table.userId),
    index("stripe_invoice_status_idx").on(table.status),
    index("stripe_invoice_created_idx").on(table.createdAt),
  ],
);

export const stripeWebhookEvent = mysqlTable(
  "stripe_webhook_event",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    type: varchar("type", { length: 100 }).notNull(),
    livemode: boolean("livemode").notNull(),
    stripeCreatedAt: timestamp("stripe_created_at").notNull(),
    processedAt: timestamp("processed_at").notNull().defaultNow(),
  },
  (table) => [index("stripe_webhook_processed_idx").on(table.processedAt)],
);

export const exportCreditAccount = mysqlTable("export_credit_account", {
  userId: varchar("user_id", { length: 36 })
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  balance: int("balance").notNull().default(0),
  lifetimePurchased: int("lifetime_purchased").notNull().default(0),
  lifetimeUsed: int("lifetime_used").notNull().default(0),
  complimentaryGranted: int("complimentary_granted").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const exportCreditPurchase = mysqlTable(
  "export_credit_purchase",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }).notNull(),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    packKey: varchar("pack_key", { length: 40 }).notNull(),
    credits: int("credits").notNull(),
    amountTotal: int("amount_total").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("jpy"),
    status: mysqlEnum("status", ["pending", "paid", "refunded"]).notNull().default("pending"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex("export_credit_purchase_session_uq").on(table.stripeCheckoutSessionId),
    uniqueIndex("export_credit_purchase_payment_intent_uq").on(table.stripePaymentIntentId),
    index("export_credit_purchase_user_idx").on(table.userId),
    index("export_credit_purchase_status_idx").on(table.status),
  ],
);

export const exportCreditLedger = mysqlTable(
  "export_credit_ledger",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", ["signup_bonus", "purchase", "export", "refund", "admin_adjustment"]).notNull(),
    delta: int("delta").notNull(),
    balanceAfter: int("balance_after").notNull(),
    sourceKey: varchar("source_key", { length: 255 }).notNull(),
    purchaseId: varchar("purchase_id", { length: 36 }).references(() => exportCreditPurchase.id, { onDelete: "set null" }),
    exportLogId: varchar("export_log_id", { length: 36 }).references(() => exportLog.id, { onDelete: "set null" }),
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("export_credit_ledger_source_uq").on(table.sourceKey),
    index("export_credit_ledger_user_idx").on(table.userId),
  ],
);

export const schema = {
  user,
  session,
  account,
  verification,
  renewalDeclaration,
  exportLog,
  adminAuditLog,
  stripeSubscription,
  stripeInvoice,
  stripeWebhookEvent,
  exportCreditAccount,
  exportCreditPurchase,
  exportCreditLedger,
};
