declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CATALOG_IMPORT_TOKEN?: string;
    BUCKET?: R2Bucket;
  }
}
