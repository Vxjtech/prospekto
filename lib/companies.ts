import 'server-only';
import {companies} from './demo-companies';
import {filterCompanies, type Company, type CompanyFilters, type CompanyPage, type PublicCompany} from './company-types';

function publicRecord(company: Company): PublicCompany {
  return {id: company.id, name: company.name, category: company.category, region: company.region};
}
function page(filters: CompanyFilters): CompanyPage<Company> {
  const source = filters.ids ? companies.filter(company => filters.ids!.includes(company.id)) : companies;
  const matches = filterCompanies(source, filters.query, filters.category, filters.region);
  const pageCount = Math.max(1, Math.ceil(matches.length / filters.pageSize));
  const current = Math.min(Math.max(1, filters.page), pageCount);
  return {
    items: matches.slice((current - 1) * filters.pageSize, current * filters.pageSize),
    total: matches.length, withEmail: matches.filter(company => company.email).length,
    page: current, pageSize: filters.pageSize, pageCount,
    catalogTotal: companies.length, ready: false, regionsAvailable: true,
  };
}
export async function getPublicCompanies(filters: CompanyFilters = {query: '', category: '', region: '', page: 1, pageSize: 4}): Promise<CompanyPage> {
  const result = page(filters);
  return {...result, items: result.items.map(publicRecord)};
}
export async function getPrivateCompanies(filters: CompanyFilters) { return page(filters); }
export async function getCompaniesByIds(ids: string[]) {
  if (ids.length > 500) throw new Error('Too many company IDs');
  return companies.filter(company => ids.includes(company.id));
}
