'use client';

import { useEffect, useRef } from 'react';

interface PermissionModalProps {
  isOpen: boolean;
  onContinue: () => void;
}

export default function PermissionModal({
  isOpen,
  onContinue,
}: PermissionModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.showModal();
    }
  }, [isOpen]);

  const handleContinue = () => {
    dialogRef.current?.close();
    onContinue();
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:backdrop-blur-sm bg-white/90 rounded-2xl shadow-2xl p-0 max-w-lg w-full"
    >
      <div className="p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Permission Required
          </h2>
          <p className="text-gray-600">
            We need your permission to send emails through Microsoft Outlook
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-gray-900 mb-2">
            You'll see a system prompt next:
          </h4>
          <p className="text-sm text-gray-700 mb-3">
            macOS will show a security dialog asking if you want to allow{' '}
            <strong>CertificateReminder</strong> to control{' '}
            <strong>Microsoft Outlook</strong>.
          </p>
          <p className="text-sm text-gray-700">
            This is normal and safe. We use this only to send certificate
            reminder emails.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-gray-900 mb-2">
            After the prompt appears:
          </h4>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>Click &quot;Open System Settings&quot;</li>
            <li>Find &quot;CertificateReminder&quot; in the Automation list</li>
            <li>Check the box next to &quot;Microsoft Outlook&quot;</li>
            <li>Come back to this app</li>
          </ol>
        </div>

        <button
          onClick={handleContinue}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          I'm ready, show the prompt
        </button>
      </div>
    </dialog>
  );
}
