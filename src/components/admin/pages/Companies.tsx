import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { ADMIN_COMPANIES_QUERY, ADMIN_MODULES_QUERY, ADMIN_SET_COMPANY_MODULES_MUTATION, ADMIN_COMPANIES_QUERY as REFETCH_QUERY } from '../../../lib/graphql';
import { formatDate, parseModules } from '../../../lib/admin-utils';
import { Edit2, Save, X } from 'lucide-react';

interface EditingCompany {
  id: number;
  modules: string[];
}

interface CompanyType {
  id: number;
  company: string;
  activeModules: string;
  createdAt: string;
  isMultiLocationEnabled: boolean;
}

interface ModuleType {
  id: string;
  name: string;
  description?: string;
}

export const Companies: React.FC<{onToast: (type: 'success'|'error', msg: string) => void}> = ({onToast}) => {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditingCompany | null>(null);

  const { data: companiesData, loading: companiesLoading, error: companiesError, refetch: refetchCompanies } = useQuery<{adminCompanies: CompanyType[]}, {search: string | null}, any>(ADMIN_COMPANIES_QUERY, {
    variables: { search: search || null }
  });

  const { data: modulesData } = useQuery<{adminModules: ModuleType[]}, {includeInactive: boolean}, any>(ADMIN_MODULES_QUERY, {
    variables: { includeInactive: false }
  });

  const [setCompanyModules] = useMutation(ADMIN_SET_COMPANY_MODULES_MUTATION);

  const handleSaveModules = async () => {
    if (!editing) return;
    try {
      await setCompanyModules({
        variables: {
          companyId: editing.id,
          modules: editing.modules
        }
      });
      onToast('success', 'Company modules updated');
      setEditing(null);
      refetchCompanies();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to update company modules');
    }
  };

  if (companiesLoading) return <div className="text-center py-12 text-slate-500">Loading companies...</div>;
  if (companiesError) return <div className="text-center py-12 text-red-600">Error: {companiesError.message}</div>;

  const companies = companiesData?.adminCompanies || [];
  const allModules = modulesData?.adminModules || [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Companies</h2>
        <p className="text-slate-600">Manage tenants and their active modules</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Search Companies</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Company name..."
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Module Editor Modal */}
      {editing && (
        <div className="border-2 rounded-2xl p-8 space-y-4 backdrop-blur-md" style={{
          background: 'linear-gradient(135deg, rgba(232, 252, 249, 0.9) 0%, rgba(225, 245, 254, 0.9) 100%)',
          borderColor: 'rgba(0, 203, 214, 0.3)',
          boxShadow: '0 8px 24px rgba(0, 203, 214, 0.15)'
        }}>
          <h3 className="font-bold text-lg" style={{color: '#00cbd6'}}>Edit Company Modules</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Select Modules</label>
            <div className="space-y-2">
              {allModules.map((module: any) => (
                <label key={module.id} className="flex items-center gap-3 p-3 hover:bg-blue-100 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.modules.includes(module.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEditing({...editing, modules: [...editing.modules, module.id]});
                      } else {
                        setEditing({...editing, modules: editing.modules.filter(m => m !== module.id)});
                      }
                    }}
                    className="rounded"
                  />
                  <div>
                    <div className="font-medium text-slate-800">{module.name}</div>
                    <div className="text-sm text-slate-600">{module.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveModules}
              className="flex items-center gap-2 px-6 py-2 text-white rounded-xl font-bold transition-all hover:scale-105 hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #00cbd6 0%, #10b981 100%)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 203, 214, 0.3)'
              }}
            >
              <Save className="w-4 h-4" />
              Save Modules
            </button>
          </div>
        </div>
      )}

      {/* Companies Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {companies.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {search ? 'No companies match your search' : 'No companies found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Company Name</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Active Modules</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Multi-Location</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Created</th>
                  <th className="text-right py-4 px-6 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company: any) => {
                  const moduleIds = parseModules(company.activeModules);
                  return (
                    <tr key={company.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-4 px-6 font-medium text-slate-800">{company.company}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-2">
                          {moduleIds.length === 0 ? (
                            <span className="text-slate-400 text-sm">No modules</span>
                          ) : (
                            moduleIds.map((modId) => {
                              const mod = allModules.find(m => m.id === modId);
                              return (
                                <span
                                  key={modId}
                                  className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                                >
                                  {mod?.name || modId}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          company.isMultiLocationEnabled
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {company.isMultiLocationEnabled ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-sm">
                        {formatDate(company.createdAt)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setEditing({id: company.id, modules: moduleIds})}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
