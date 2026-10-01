CREATE VIRTUAL TABLE catalog_search USING fts5(name, ico, content='catalog_companies', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
--> statement-breakpoint
CREATE TRIGGER catalog_search_insert AFTER INSERT ON catalog_companies BEGIN
 INSERT INTO catalog_search(rowid,name,ico) VALUES (new.rowid,new.name,new.ico);
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_delete AFTER DELETE ON catalog_companies BEGIN
 INSERT INTO catalog_search(catalog_search,rowid,name,ico) VALUES ('delete',old.rowid,old.name,old.ico);
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_update AFTER UPDATE OF name,ico ON catalog_companies BEGIN
 INSERT INTO catalog_search(catalog_search,rowid,name,ico) VALUES ('delete',old.rowid,old.name,old.ico);
 INSERT INTO catalog_search(rowid,name,ico) VALUES (new.rowid,new.name,new.ico);
END;
