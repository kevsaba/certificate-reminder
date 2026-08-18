'use client';

import { useEffect, useRef } from 'react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({
  isOpen,
  onClose,
}: WelcomeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.showModal();
    }
  }, [isOpen]);

  const handleClose = () => {
    dialogRef.current?.close();
    // Store that user has seen welcome
    localStorage.setItem('certificateReminder_welcomeSeen', 'true');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:backdrop-blur-sm bg-white/90 rounded-2xl shadow-2xl p-0 max-w-2xl w-full"
      onClose={handleClose}
    >
      <div className="p-8">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to CertificateReminder! 👋
          </h2>
          <p className="text-gray-600">
            Let's get you set up to send certificate expiration reminders
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                Upload your Excel file
              </h3>
              <p className="text-sm text-gray-600">
                Drag and drop your Excel file with certificate data
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                Send email reminders
              </h3>
              <p className="text-sm text-gray-600">
                We'll use Microsoft Outlook to send personalized email
                notifications
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-yellow-50 rounded-lg">
            <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                Grant permissions when prompted
              </h3>
              <p className="text-sm text-gray-600">
                When you first send emails, macOS will ask for permission to
                control Outlook. This is normal and safe - it just lets us send
                emails on your behalf.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-gray-900 mb-2">
            What to expect:
          </h4>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>
                A system prompt will appear asking for Outlook access
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>
                Click &quot;Open System Settings&quot; and check the box next
                to Microsoft Outlook
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Come back to the app and try again</span>
            </li>
          </ul>
        </div>

        <button
          onClick={handleClose}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Got it, let's start!
        </button>
      </div>
    </dialog>
  );
}
