// Main UI entry point for CertificateReminder
// This runs in the Chromium window

export default {
  // Called when the window is created
  async ready() {
    console.log('CertificateReminder UI is ready!');
    console.log('Window should be visible now');

    // The HTML file handles connecting to the local Bun server.
    // and loading the Next.js app in an iframe
  },

  // Called when window is about to close
  async closing() {
    console.log('Window is closing...');
  }
};
