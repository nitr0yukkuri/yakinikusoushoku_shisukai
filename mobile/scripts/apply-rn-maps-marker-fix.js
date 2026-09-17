const fs = require('fs');
const path = require('path');

const markerFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-maps',
  'android',
  'src',
  'main',
  'java',
  'com',
  'rnmaps',
  'maps',
  'MapMarker.java',
);

if (!fs.existsSync(markerFile)) {
  process.exit(0);
}

let source = fs.readFileSync(markerFile, 'utf8');
if (source.includes('expandSnapshotSizeFromSubtree')) {
  process.exit(0);
}

const importTarget = 'import android.view.View;';
if (!source.includes(importTarget)) {
  throw new Error('Unsupported react-native-maps MapMarker.java: import location not found.');
}
source = source.replace(importTarget, `${importTarget}\nimport android.view.ViewGroup;`);

const methodTarget = `  private void clearDrawableCache() {
    mLastBitmapCreated = null;
  }

  private Bitmap createDrawable() {`;
const methodReplacement = `  private void clearDrawableCache() {
    mLastBitmapCreated = null;
  }

  private static void expandSnapshotSizeFromSubtree(View root, int offsetX, int offsetY, int[] maxWh) {
    if (root == null || root.getVisibility() == View.GONE) {
      return;
    }
    int width = root.getWidth();
    int height = root.getHeight();
    if (width <= 0) {
      width = root.getMeasuredWidth();
    }
    if (height <= 0) {
      height = root.getMeasuredHeight();
    }
    int left = offsetX + root.getLeft();
    int top = offsetY + root.getTop();
    if (width > 0) {
      maxWh[0] = Math.max(maxWh[0], left + width);
    }
    if (height > 0) {
      maxWh[1] = Math.max(maxWh[1], top + height);
    }
    if (root instanceof ViewGroup) {
      ViewGroup viewGroup = (ViewGroup) root;
      for (int index = 0; index < viewGroup.getChildCount(); index += 1) {
        View child = viewGroup.getChildAt(index);
        if (child instanceof MapCallout) {
          continue;
        }
        expandSnapshotSizeFromSubtree(child, left, top, maxWh);
      }
    }
  }

  private Bitmap createDrawable() {`;
if (!source.includes(methodTarget)) {
  throw new Error('Unsupported react-native-maps MapMarker.java: method location not found.');
}
source = source.replace(methodTarget, methodReplacement);

const sizeTarget = `    int width = this.width <= 0 ? 100 : this.width;
    int height = this.height <= 0 ? 100 : this.height;
    this.buildDrawingCache();`;
const sizeReplacement = `    int width = this.width <= 0 ? 100 : this.width;
    int height = this.height <= 0 ? 100 : this.height;
    if (hasCustomMarkerView && getChildCount() > 0) {
      int[] maxWh = new int[] {width, height};
      for (int index = 0; index < getChildCount(); index += 1) {
        View child = getChildAt(index);
        if (child instanceof MapCallout) {
          continue;
        }
        expandSnapshotSizeFromSubtree(child, 0, 0, maxWh);
      }
      width = maxWh[0];
      height = maxWh[1];
    }
    this.buildDrawingCache();`;
if (!source.includes(sizeTarget)) {
  throw new Error('Unsupported react-native-maps MapMarker.java: size location not found.');
}
source = source.replace(sizeTarget, sizeReplacement);

fs.writeFileSync(markerFile, source);
