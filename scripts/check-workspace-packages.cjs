const fs = require("node:fs");

const workspaceRoots = ["apps", "packages"];

const hasWorkspacePackage = workspaceRoots.some((root) => {
  if (!fs.existsSync(root)) {
    return false;
  }

  return fs.readdirSync(root, { withFileTypes: true }).some((entry) => {
    return entry.isDirectory() && fs.existsSync(`${root}/${entry.name}/package.json`);
  });
});

if (!hasWorkspacePackage) {
  console.error("No workspace packages found under apps/* or packages/*");
  process.exit(1);
}
