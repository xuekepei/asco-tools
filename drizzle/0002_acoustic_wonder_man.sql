CREATE TABLE `stripe_invoice` (
	`id` varchar(36) NOT NULL,
	`stripe_invoice_id` varchar(255) NOT NULL,
	`user_id` varchar(36),
	`stripe_customer_id` varchar(255),
	`stripe_subscription_id` varchar(255),
	`number` varchar(100),
	`status` varchar(40),
	`currency` varchar(3) NOT NULL DEFAULT 'jpy',
	`subtotal` int NOT NULL DEFAULT 0,
	`tax` int NOT NULL DEFAULT 0,
	`total` int NOT NULL DEFAULT 0,
	`amount_due` int NOT NULL DEFAULT 0,
	`amount_paid` int NOT NULL DEFAULT 0,
	`amount_remaining` int NOT NULL DEFAULT 0,
	`payment_failed` boolean NOT NULL DEFAULT false,
	`hosted_invoice_url` text,
	`invoice_pdf` text,
	`period_start` timestamp,
	`period_end` timestamp,
	`paid_at` timestamp,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_invoice_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_invoice_stripe_id_uq` UNIQUE(`stripe_invoice_id`)
);
--> statement-breakpoint
CREATE TABLE `stripe_subscription` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`stripe_subscription_id` varchar(255) NOT NULL,
	`stripe_customer_id` varchar(255) NOT NULL,
	`price_id` varchar(255),
	`status` varchar(40) NOT NULL,
	`billing_interval` enum('month','year'),
	`interval_count` int NOT NULL DEFAULT 1,
	`unit_amount` int,
	`currency` varchar(3) NOT NULL DEFAULT 'jpy',
	`current_period_start` timestamp,
	`current_period_end` timestamp,
	`cancel_at_period_end` boolean NOT NULL DEFAULT false,
	`canceled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_subscription_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_subscription_stripe_id_uq` UNIQUE(`stripe_subscription_id`),
	CONSTRAINT `stripe_subscription_user_uq` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `stripe_webhook_event` (
	`id` varchar(255) NOT NULL,
	`type` varchar(100) NOT NULL,
	`livemode` boolean NOT NULL,
	`stripe_created_at` timestamp NOT NULL,
	`processed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripe_webhook_event_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_customer_id` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD CONSTRAINT `user_stripe_customer_uq` UNIQUE(`stripe_customer_id`);--> statement-breakpoint
ALTER TABLE `stripe_invoice` ADD CONSTRAINT `stripe_invoice_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stripe_subscription` ADD CONSTRAINT `stripe_subscription_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `stripe_invoice_user_idx` ON `stripe_invoice` (`user_id`);--> statement-breakpoint
CREATE INDEX `stripe_invoice_status_idx` ON `stripe_invoice` (`status`);--> statement-breakpoint
CREATE INDEX `stripe_invoice_created_idx` ON `stripe_invoice` (`created_at`);--> statement-breakpoint
CREATE INDEX `stripe_subscription_status_idx` ON `stripe_subscription` (`status`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_processed_idx` ON `stripe_webhook_event` (`processed_at`);