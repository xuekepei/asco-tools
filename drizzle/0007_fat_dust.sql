CREATE TABLE `feature_flag` (
	`key` varchar(64) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feature_flag_key` PRIMARY KEY(`key`)
);
