import 'server-only';
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {COMPANY_CATEGORIES, normalizeSearch, type Company, type CompanyFilters, type CompanyPage, type PublicCompany} from './company-types';

type CompanyRow = {source_key: string; name: string; phones: string; emails: string; websites: string; ico: string};
type CategoryRow = {source_key: string; name: string};
let database: DatabaseSync | undefined;
let catalogTotal: number | undefined;

function getDatabase() {
  if (database) return database;
  const filename = resolve(process.env.COMPANIES_DATABASE_PATH || 'data/companies.sqlite3');
  database = new DatabaseSync(filename, {readOnly: true});
  database.function('prospekto_normalize', {deterministic: true}, value => normalizeSearch(String(value ?? '')));
  return database;
}

function readArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && !!item.trim()) : [];
  } catch {
    return [];
  }
}

function mapRows(rows: CompanyRow[]): Company[] {
  if (!rows.length) return [];
  const db = getDatabase();
  const placeholders = rows.map(() => '?').join(',');
  const categoryRows = db.prepare(`SELECT source_key, name FROM company_categories WHERE source_key IN (${placeholders}) ORDER BY name`).all(...rows.map(row => row.source_key)) as CategoryRow[];
  const categoriesByCompany = new Map<string, string[]>();
  for (const row of categoryRows) {
    const names = categoriesByCompany.get(row.source_key) ?? [];
    if (!names.includes(row.name)) names.push(row.name);
    categoriesByCompany.set(row.source_key, names);
  }
  return rows.map(row => {
    const categoryNames = categoriesByCompany.get(row.source_key) ?? [];
    const categories = categoryNames.flatMap(name => {
      const match = COMPANY_CATEGORIES.find(category => category.label === name);
      return match ? [match.id] : [];
    });
    const phones = readArray(row.phones), emails = readArray(row.emails), websites = readArray(row.websites);
    return {
      id: row.source_key, name: row.name, city: '', category: categories[0] ?? '', categories,
      region: '', industry: categoryNames[0] ?? '', ico: row.ico,
      phones, emails, websites, phone: phones[0] ?? '', email: emails[0] ?? '', website: websites[0] ?? '',
    };
  });
}

function filtersWhere(filters: CompanyFilters) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filters.ids) {
    if (!filters.ids.length) where.push('0');
    else {
      where.push('c.source_key IN (SELECT value FROM json_each(?))');
      params.push(JSON.stringify(filters.ids));
    }
  }
  if (filters.category) {
    const category = COMPANY_CATEGORIES.find(item => item.id === filters.category);
    if (category) {
      where.push('EXISTS (SELECT 1 FROM company_categories cc WHERE cc.source_key=c.source_key AND cc.name=?)');
      params.push(category.label);
    }
  }
  if (filters.region) where.push('0');
  const searchTerms = normalizeSearch(filters.query).split(/\s+/).filter(Boolean);
  for (const term of searchTerms) {
    where.push(`prospekto_normalize(c.name || ' ' || c.ico || ' ' || COALESCE((SELECT group_concat(cc.name, ' ') FROM company_categories cc WHERE cc.source_key=c.source_key), '')) LIKE ?`);
    params.push(`%${term}%`);
  }
  return {sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params};
}

export function getFilteredCompanyIds(filters: CompanyFilters): string[] {
  const {sql, params} = filtersWhere(filters);
  return getDatabase().prepare(`SELECT c.source_key AS id FROM companies c ${sql} ORDER BY c.name COLLATE NOCASE, c.source_key`).all(...params).map(row => String(row.id));
}

export function areCompanyIdsValid(ids: string[]): boolean {
  if (!ids.length || ids.length > 250000) return false;
  const result = getDatabase().prepare('SELECT COUNT(*) AS count FROM companies WHERE source_key IN (SELECT value FROM json_each(?))').get(JSON.stringify(ids)) as {count: number};
  return Number(result.count) === ids.length;
}

function page(filters: CompanyFilters): CompanyPage<Company> {
  const db = getDatabase();
  const {sql: whereSql, params} = filtersWhere(filters);
  const stats = db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN json_array_length(c.emails)>0 THEN 1 ELSE 0 END),0) AS withEmail FROM companies c ${whereSql}`).get(...params) as {total: number; withEmail: number};
  catalogTotal ??= Number(db.prepare('SELECT COUNT(*) AS total FROM companies').get()?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(stats.total / filters.pageSize));
  const current = Math.min(Math.max(1, filters.page), pageCount);
  const rows = db.prepare(`SELECT c.source_key, c.name, c.phones, c.emails, c.websites, c.ico FROM companies c ${whereSql} ORDER BY c.name COLLATE NOCASE, c.source_key LIMIT ? OFFSET ?`).all(...params, filters.pageSize, (current - 1) * filters.pageSize) as CompanyRow[];
  return {
    items: mapRows(rows), total: Number(stats.total), withEmail: Number(stats.withEmail),
    page: current, pageSize: filters.pageSize, pageCount, catalogTotal, ready: true, regionsAvailable: false,
  };
}

function publicRecord(company: Company): PublicCompany {
  return {id: company.id, name: company.name, category: company.category, region: company.region};
}

export async function getPublicCompanies(filters: CompanyFilters = {query: '', category: '', region: '', page: 1, pageSize: 4}): Promise<CompanyPage> {
  const result = page(filters);
  return {...result, items: result.items.map(publicRecord)};
}

export async function getPrivateCompanies(filters: CompanyFilters) {
  return page(filters);
}

export async function getCompaniesByIds(ids: string[]) {
  if (ids.length > 500) throw new Error('Too many company IDs');
  return page({query: '', category: '', region: '', page: 1, pageSize: Math.max(1, ids.length), ids}).items;
}
