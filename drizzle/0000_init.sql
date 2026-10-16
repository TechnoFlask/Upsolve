CREATE TABLE `accounts` (
	`platform` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`last_synced_at` integer
);
--> statement-breakpoint
CREATE TABLE `contests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`date` integer,
	`rank` integer,
	`old_rating` integer,
	`new_rating` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contests_platform_ext_idx` ON `contests` (`platform`,`external_id`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_ip_at_idx` ON `login_attempts` (`ip`,`at`);--> statement-breakpoint
CREATE TABLE `problems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`difficulty` integer,
	`difficulty_label` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'solved' NOT NULL,
	`tries` integer DEFAULT 1 NOT NULL,
	`used_editorial` integer DEFAULT false NOT NULL,
	`solved_at` integer,
	`notes` text,
	`ai_approach` text,
	`ai_model` text,
	`contest_id` integer,
	`solved_in_contest` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `contests`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `problems_platform_ext_idx` ON `problems` (`platform`,`external_id`);--> statement-breakpoint
CREATE INDEX `problems_status_idx` ON `problems` (`status`);--> statement-breakpoint
CREATE INDEX `problems_solved_at_idx` ON `problems` (`solved_at`);