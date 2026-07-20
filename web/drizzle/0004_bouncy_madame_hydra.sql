CREATE TABLE `export_credit_account` (
	`user_id` varchar(36) NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`lifetime_purchased` int NOT NULL DEFAULT 0,
	`lifetime_used` int NOT NULL DEFAULT 0,
	`complimentary_granted` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `export_credit_account_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `export_credit_ledger` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`type` enum('signup_bonus','purchase','export','refund','admin_adjustment') NOT NULL,
	`delta` int NOT NULL,
	`balance_after` int NOT NULL,
	`source_key` varchar(255) NOT NULL,
	`purchase_id` varchar(36),
	`export_log_id` varchar(36),
	`description` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `export_credit_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `export_credit_ledger_source_uq` UNIQUE(`source_key`)
);
--> statement-breakpoint
CREATE TABLE `export_credit_purchase` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`stripe_checkout_session_id` varchar(255) NOT NULL,
	`stripe_payment_intent_id` varchar(255),
	`stripe_customer_id` varchar(255) NOT NULL,
	`pack_key` varchar(40) NOT NULL,
	`credits` int NOT NULL,
	`amount_total` int NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'jpy',
	`status` enum('pending','paid','refunded') NOT NULL DEFAULT 'pending',
	`paid_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `export_credit_purchase_id` PRIMARY KEY(`id`),
	CONSTRAINT `export_credit_purchase_session_uq` UNIQUE(`stripe_checkout_session_id`),
	CONSTRAINT `export_credit_purchase_payment_intent_uq` UNIQUE(`stripe_payment_intent_id`)
);
--> statement-breakpoint
ALTER TABLE `export_credit_account` ADD CONSTRAINT `export_credit_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `export_credit_ledger` ADD CONSTRAINT `export_credit_ledger_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `export_credit_ledger` ADD CONSTRAINT `export_credit_ledger_purchase_id_export_credit_purchase_id_fk` FOREIGN KEY (`purchase_id`) REFERENCES `export_credit_purchase`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `export_credit_ledger` ADD CONSTRAINT `export_credit_ledger_export_log_id_export_log_id_fk` FOREIGN KEY (`export_log_id`) REFERENCES `export_log`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `export_credit_purchase` ADD CONSTRAINT `export_credit_purchase_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `export_credit_ledger_user_idx` ON `export_credit_ledger` (`user_id`);--> statement-breakpoint
CREATE INDEX `export_credit_purchase_user_idx` ON `export_credit_purchase` (`user_id`);--> statement-breakpoint
CREATE INDEX `export_credit_purchase_status_idx` ON `export_credit_purchase` (`status`);