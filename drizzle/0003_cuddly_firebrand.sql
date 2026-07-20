ALTER TABLE `stripe_invoice` ADD `last_event_created_at` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_subscription` ADD `last_event_created_at` timestamp NOT NULL;