'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CertificateEntry, Template } from '@/types';
import DataTable from '@/components/DataTable';
import WelcomeModal from '@/components/WelcomeModal';
import PermissionModal from '@/components/PermissionModal';
import PermissionIndicator from '@/components/PermissionIndicator';
import { extractBaseCategory } from '@/lib/expiration';

interface NotificationResult {
  emailsSent?: number;
  checked: number;
  failed: number;
  timestamp: Date;
}

export default function Home() {
  const [entries, setEntries] = useState<CertificateEntry[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [templateFilename, setTemplateFilename] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastResult, setLastResult] = useState<NotificationResult | null>(null);
  const [enabledCategories, setEnabledCategories] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');

  const categoryOptions = useMemo(() => {
    const hiddenSet = new Set(hiddenCategories);
    return Array.from(new Set([
      ...entries.map(entry => extractBaseCategory(entry.category).toUpperCase()),
      ...customCategories,
    ]))
      .filter(category => !hiddenSet.has(category))
      .sort();
  }, [entries, customCategories, hiddenCategories]);

  // Permission UX state
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('certificateReminder_welcomeSeen') === null;
    }
    return false;
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [outlookPermission, setOutlookPermission] = useState<boolean | null>(null);

  // Check permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const response = await fetch('/api/permissions');
        if (response.ok) {
          const data = await response.json();
          setOutlookPermission(data.outlook.permission);
        }
      } catch (error) {
        console.error('Failed to check permission:', error);
      }
    };
    checkPermission();
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.customCategories)) {
            setCustomCategories(data.customCategories);
          }
          if (Array.isArray(data.hiddenCategories)) {
            setHiddenCategories(data.hiddenCategories);
          }
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };

    loadCategories();
  }, []);

  const handleExcelUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'excel');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Upload failed');
        return;
      }

      const uploadedEntries = data.entries as CertificateEntry[];
      const hiddenSet = new Set(hiddenCategories);
      const uploadedCategories = Array.from(
        new Set(uploadedEntries.map(entry => extractBaseCategory(entry.category).toUpperCase()))
      )
        .filter(category => !hiddenSet.has(category))
        .sort();

      setEntries(uploadedEntries);
      setFilename(file.name);
      setEnabledCategories(uploadedCategories);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload');
    } finally {
      setUploading(false);
    }
  }, [hiddenCategories]);

  const handleWordUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'word');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Upload failed');
        return;
      }

      setTemplates(data.templates);
      setTemplateFilename(file.name);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, type: 'excel' | 'word') => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (type === 'excel') {
      handleExcelUpload(file);
    } else {
      handleWordUpload(file);
    }
  }, [handleExcelUpload, handleWordUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'excel' | 'word') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'excel') {
      handleExcelUpload(file);
    } else {
      handleWordUpload(file);
    }
  }, [handleExcelUpload, handleWordUpload]);

  const runCheck = async () => {
    if (entries.length === 0) {
      alert('Please upload an Excel file first');
      return;
    }

    if (enabledCategories.length === 0) {
      alert('Please enable at least one category before sending emails');
      return;
    }

    // Prevent double-click/double-invocation (React 19 dev mode issue)
    if (checking) {
      return;
    }

    // Check permission before sending
    if (outlookPermission === false) {
      setShowPermissionModal(true);
      return;
    }

    setChecking(true);
    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels: { email: true },
          enabledCategories,
        }),
      });
      const data = await response.json();

      if (data.success) {
        setLastResult({
          emailsSent: data.result.emailsSent || 0,
          checked: data.result.checked,
          failed: data.result.failed || 0,
          timestamp: data.result.timestamp,
        });
      } else {
        // Check if it's a permission error
        if (
          data.error === 'PERMISSION_DENIED' ||
          data.details?.includes('permission')
        ) {
          setOutlookPermission(false);
          setShowPermissionModal(true);
        } else {
          alert(data.error || 'Check failed');
        }
      }
    } catch (err) {
      console.error('Check failed:', err);
      alert('Failed to run check');
    } finally {
      setChecking(false);
    }
  };

  const toggleCategory = (category: string) => {
    setEnabledCategories(current =>
      current.includes(category)
        ? current.filter(enabled => enabled !== category)
        : [...current, category].sort()
    );
  };

  const addCustomCategory = async () => {
    const category = newCategory.trim().toUpperCase();
    if (!category) return;

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to add category');
        return;
      }

      const updatedCategories = Array.isArray(data.customCategories)
        ? data.customCategories
        : [...customCategories, category].sort();

      setCustomCategories(updatedCategories);
      setEnabledCategories(current => Array.from(new Set([...current, category])).sort());
      setNewCategory('');
    } catch (error) {
      console.error('Failed to add category:', error);
      alert('Failed to add category');
    }
  };

  const shutdownApp = async () => {
    if (confirm('Are you sure you want to close the application?')) {
      try {
        await fetch('/api/shutdown', { method: 'POST' });
        // Browser will close when server stops
        setTimeout(() => {
          window.close();
          // Fallback: show message if window.close() doesn't work
          setTimeout(() => {
            alert('Application is shutting down. You can close this tab now.');
          }, 500);
        }, 500);
      } catch (err) {
        alert('Failed to shutdown gracefully. You can close this tab manually.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Certificate Expiration Reminder
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-500">
                Upload Excel file with certificate data and Word templates to send email reminders
              </p>
              <PermissionIndicator
                granted={outlookPermission === true}
                loading={outlookPermission === null}
              />
            </div>
          </div>
          <button
            onClick={shutdownApp}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm flex items-center gap-2 transition-colors"
            title="Close the application"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close App
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* App Status Banner */}
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800">Application is ready</p>
            <p className="text-xs text-green-700 mt-1">
              The server is running in the background. When you're done, click the <strong>Close App</strong> button in the top-right corner.
            </p>
          </div>
        </div>

        <div className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Excel Data
                </h2>
                {filename && (
                  <span className="text-sm text-green-600">
                    ✓ {filename}
                  </span>
                )}
              </div>
              
              <div
                onDrop={(e) => handleDrop(e, 'excel')}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50"
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileSelect(e, 'excel')}
                  className="hidden"
                  id="excel-upload"
                />
                <label htmlFor="excel-upload" className="cursor-pointer">
                  <svg className="w-10 h-10 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-2 text-gray-600">
                    {uploading ? 'Uploading...' : 'Drop Excel file or click to select'}
                  </p>
                </label>
              </div>
              
              <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                <p className="font-medium mb-1">Required columns (Overview or Worksheet sheet):</p>
                <p>Old format: Pseudonym, Documentacion, email, Fecha Caducidad</p>
                <p className="mt-1">New format: Nombre Trabajador, DNI, Puesto Trabajo, Documentacion, Fecha Alta, Fecha Caducidad, Email</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Word Templates
                </h2>
                {templateFilename && (
                  <span className="text-sm text-green-600">
                    ✓ {templateFilename}
                  </span>
                )}
              </div>
              
              <div
                onDrop={(e) => handleDrop(e, 'word')}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50"
              >
                <input
                  type="file"
                  accept=".docx,.doc"
                  onChange={(e) => handleFileSelect(e, 'word')}
                  className="hidden"
                  id="word-upload"
                />
                <label htmlFor="word-upload" className="cursor-pointer">
                  <svg className="w-10 h-10 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-2 text-gray-600">
                    {uploading ? 'Uploading...' : 'Drop Word file or click to select'}
                  </p>
                </label>
              </div>
              
              <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                <p className="font-medium mb-1">Template requirements:</p>
                <p>Each page must start with its matching title. Missing pages are skipped.</p>
                <p className="mt-1">Use placeholders: [NAME] and [DATE]</p>
              </div>
              
              {templates.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-blue-800">
                  <p className="font-medium">Loaded templates:</p>
                  <p>{templates.map(t => t.type).join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          {entries.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Certificate Data ({entries.length} entries)
              </h2>
              <DataTable entries={entries} />
            </div>
          )}

          {entries.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Send Email Reminders
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Send email notifications for expired certificates in the enabled categories
                  </p>
                </div>
              </div>

              <div className="mb-5 rounded border border-gray-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Enabled Categories</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Disabled categories are skipped for this run.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEnabledCategories(categoryOptions)}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white text-black hover:bg-gray-50"
                    >
                      Enable All
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnabledCategories([])}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white text-black hover:bg-gray-50"
                    >
                      Disable All
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {categoryOptions.map(category => (
                    <label
                      key={category}
                      className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-black bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={enabledCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600"
                      />
                      <span className="truncate">{category}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addCustomCategory();
                      }
                    }}
                    placeholder="New category"
                    className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomCategory}
                    className="px-3 py-2 text-sm border border-gray-300 rounded bg-white text-black hover:bg-gray-50"
                  >
                    Add Category
                  </button>
                </div>
                {customCategories.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    Re-upload Word templates after adding a category so its page can be recognized.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {entries.length} entries loaded · {enabledCategories.length} categories enabled
                </div>

                <button
                  onClick={runCheck}
                  disabled={checking || enabledCategories.length === 0}
                  className="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {checking ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending Emails...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Email Reminders
                    </>
                  )}
                </button>
              </div>

              {/* Notification Summary */}
              {lastResult && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800">Emails Sent Successfully</p>
                      <p className="text-xs text-green-700 mt-1">
                        Check completed at {new Date(lastResult.timestamp).toLocaleString()}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="bg-white rounded p-3 text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {(lastResult as any).emailsSent || 0}
                          </p>
                          <p className="text-xs text-gray-600">Emails Sent</p>
                        </div>
                        <div className="bg-white rounded p-3 text-center">
                          <p className="text-2xl font-bold text-gray-700">{lastResult.checked}</p>
                          <p className="text-xs text-gray-600">Entries Checked</p>
                        </div>
                      </div>
                      {lastResult.failed > 0 && (
                        <p className="text-xs text-red-600 mt-2">
                          ⚠️ {lastResult.failed} emails failed to send.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Welcome Modal */}
      <WelcomeModal
        isOpen={showWelcome}
        onClose={() => setShowWelcome(false)}
      />

      {/* Permission Modal */}
      <PermissionModal
        isOpen={showPermissionModal}
        onContinue={async () => {
          // Trigger permission check by running test
          try {
            const response = await fetch('/api/permissions');
            const data = await response.json();
            setOutlookPermission(data.outlook.permission);
          } catch (error) {
            console.error('Failed to check permission:', error);
          }
        }}
      />
    </div>
  );
}
