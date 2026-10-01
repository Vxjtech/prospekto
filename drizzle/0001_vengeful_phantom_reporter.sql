CREATE TABLE `catalog_categories` (
	`company_id` text NOT NULL,
	`category` text NOT NULL,
	PRIMARY KEY(`category`, `company_id`),
	FOREIGN KEY (`company_id`) REFERENCES `catalog_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `catalog_chunks` (
	`id` integer PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`rows` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_name` text NOT NULL,
	`ico` text NOT NULL,
	`phones` text NOT NULL,
	`emails` text NOT NULL,
	`websites` text NOT NULL,
	`categories` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`source_url` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catalog_name` ON `catalog_companies` (`sort_name`,`id`);--> statement-breakpoint
CREATE INDEX `catalog_region` ON `catalog_companies` (`region`,`sort_name`);--> statement-breakpoint
CREATE INDEX `catalog_ico` ON `catalog_companies` (`ico`);--> statement-breakpoint
CREATE TABLE `catalog_meta` (
	`id` text PRIMARY KEY NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`with_email` integer DEFAULT 0 NOT NULL,
	`regions_available` integer DEFAULT 0 NOT NULL,
	`imported_at` text DEFAULT '' NOT NULL
);
