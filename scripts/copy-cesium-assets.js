const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const cesiumSource = path.join(projectRoot, "node_modules/cesium/Build/Cesium");
const cesiumDestination = path.join(projectRoot, "public/cesium");

const folders = ["Assets", "Workers", "ThirdParty", "Widgets"];

function copyDir(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

for (const folder of folders) {
  copyDir(
    path.join(cesiumSource, folder),
    path.join(cesiumDestination, folder)
  );
}
