export default {
  app: {
    name: "CertificateReminder",
    identifier: "com.certificates.reminder",
    version: "9.0.0",
    icon: "CertificateReminder.icns",
  },
  build: {
    buildFolder: "build",
    artifactFolder: "artifacts",
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      "main-ui": {
        entrypoint: "src/main-ui/index.ts",
        autoOpen: true,
      },
    },
    copy: {
      "src/main-ui/index.html": "views/main-ui/index.html",
      "out": "static",
    },
  },
};
