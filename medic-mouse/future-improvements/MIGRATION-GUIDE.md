# Medic Mouse Dashboard - Iframe to Template Migration Guide

## Overview
This guide explains how to migrate from iframe-based pages to the new template loading system.

## Architecture Changes

### Old System (Iframes)
```html
<iframe src="medic-mouse-test-dashboard.html" style="width: 100%; height: 100%; border: none;"></iframe>
```
- Separate complete HTML files
- Loaded in iframes
- Isolated CSS/JS
- Navigation issues

### New System (Template Loading)
```javascript
// Dynamically loads page content
await fetch('pages/testing.html')
```
- HTML fragments (no <html>, <head>, <body>)
- Loaded into main dashboard
- Unified navigation
- Better performance

## Migration Steps

### 1. Update Main Dashboard
Replace your current `medic-mouse-dashboard.html` with `medic-mouse-dashboard-refactored.html`:
```bash
cp medic-mouse-dashboard-refactored.html medic-mouse-dashboard.html
```

### 2. Create Pages Directory
```bash
mkdir pages
```

### 3. Convert Each Page

For each standalone HTML file (e.g., `medic-mouse-test-dashboard.html`):

#### Step 1: Create Template Version
Create `pages/testing.html` containing ONLY:
- The content inside `<body>` tags
- Any page-specific `<style>` tags
- Any page-specific `<script>` tags

#### Step 2: Remove HTML Structure
Remove these elements from the template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>...</title>
    <!-- Remove all meta tags -->
</head>
<body>
    <!-- Keep only this content -->
</body>
</html>
```

#### Step 3: Update IDs and Functions
To avoid conflicts, prefix IDs and function names:
- `chatMessages` → `testChatMessages`
- `sendMessage()` → `sendTestMessage()`
- etc.

#### Step 4: Add Initialization Function
Add an init function for your page:
```javascript
window.initTestingPage = function() {
    console.log('Testing page initialized');
    // Your initialization code here
};
```

### 4. Update External Pages List
In `medic-mouse-dashboard.html`, update the mapping:
```javascript
const externalPages = {
    'testing': 'pages/testing.html',
    'scraper': 'pages/scraper.html',
    'usage': 'pages/usage.html',
    'responses': 'pages/responses.html'
};
```

## Benefits

1. **Consistent Navigation**: No more iframe back/forward issues
2. **Unified Styling**: Shared CSS across all pages
3. **Better Performance**: No iframe overhead
4. **Easier Maintenance**: Edit individual page files
5. **Seamless Experience**: Feels like a single-page app

## Example Migration

### Before (medic-mouse-test-dashboard.html):
```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Dashboard</title>
    <style>
        .test-container { ... }
    </style>
</head>
<body>
    <div class="test-container">
        <h1>Testing Console</h1>
        <!-- content -->
    </div>
    <script>
        function sendMessage() { ... }
    </script>
</body>
</html>
```

### After (pages/testing.html):
```html
<style>
    .test-container { ... }
</style>

<div class="test-container">
    <h3>Testing Console</h3>
    <!-- content -->
</div>

<script>
    window.initTestingPage = function() {
        // Initialize
    };
    
    function sendTestMessage() { ... }
</script>
```

## Quick Conversion Script

Here's a bash script to help convert files:
```bash
#!/bin/bash
# convert-to-template.sh

INPUT=$1
OUTPUT=$2

# Extract body content
sed -n '/<body>/,/<\/body>/p' "$INPUT" | \
  sed '1d;$d' > "$OUTPUT"

echo "Converted $INPUT to $OUTPUT"
echo "Remember to:"
echo "1. Update function/ID names to avoid conflicts"
echo "2. Add initialization function"
echo "3. Test the page after migration"
```

## Testing

After migration, test each page:
1. Load the page
2. Check console for errors
3. Test all functionality
4. Verify styles look correct
5. Check that navigation works

## Rollback

If needed, you can always revert to iframes by keeping the original files and updating the dashboard to use iframes again.