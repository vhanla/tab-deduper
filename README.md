# Tab Deduper
WebExtension to clean up duplicate tabs with advanced whitelist functionality. Tested in Firefox.

## Availability
Available on AMO here: https://addons.mozilla.org/firefox/addon/tab-deduper/

## Features

### Core Functionality
- **Automatic Deduplication**: When a tab's location changes, it checks against currently open tabs in the same window. On a match, one is made active and the other is removed.
- **Multi-Window Support**: Option to check for duplicates across all non-private windows.
- **Container Support**: Respects Firefox containers - only deduplicates tabs within the same contextual identity.

### Whitelist System
- **Domain Whitelisting**: Exclude entire domains from deduplication (e.g., `example.com`)
- **Exact URL Whitelisting**: Exclude specific URLs from deduplication
- **Visual Indicators**: Context menu shows duplicate count and whitelist status
- **Smart Management**: Prevents whitelisting of special browser URLs (`about:`, extensions, etc.)

### Context Menu Integration
Right-click any tab to access:
- **Visual Status Indicators**:
  - 🚦 Active deduplication
  - 🎌 Whitelisted (no duplicates)
  - ² ³ ⁴ Superscript numbers showing duplicate count on whitelisted sites
- **Quick Actions**:
  - ➕ Add domain to whitelist
  - 📌 Add exact URL to whitelist  
  - ➖ Remove from whitelist
  - 🔴/🟢 Toggle whitelist on/off
  - 🧰 Open whitelist settings
- **Duplicate Navigation**: When multiple duplicates exist, submenu shows all instances for quick switching

## Usage

### Basic Operation
Install the extension and it works automatically. Great for tab hoarders that revisit pages already open in different tabs.

### Whitelist Management

#### Via Context Menu (Quick Access)
1. Right-click any tab
2. Use the Tab Deduper submenu:
   - Click ➕ to whitelist the domain
   - Click 📌 to whitelist the exact URL
   - Click ➖ to remove from whitelist
   - Click 🔴/🟢 to toggle whitelist feature

#### Via Options Page (Full Management)
1. Right-click the extension icon → Options, or
2. Right-click any tab → Tab Deduper → 🧰 Open whitelist settings
3. Enable whitelist feature
4. Add/remove domains and URLs
5. View and manage all whitelisted items

### Visual Indicators
- **🚦**: Deduplication is active for this tab
- **🎌**: Tab is whitelisted (single instance)
- **²³⁴**: Whitelisted tab with multiple instances (shows count)
- **🔴**: Whitelist disabled
- **🟢**: Whitelist enabled

## Configuration Options
- **Keep explicitly duplicated tabs**: Protects tabs created via "Duplicate Tab"
- **Change old tab position**: Moves older tabs to current tab position
- **Check all windows**: Extends deduplication across all non-private windows
- **Enable whitelist**: Activates the whitelist system

## Localization
Supports multiple languages:
- 🇺🇸 English
- 🇧🇬 Bulgarian  
- 🇪🇸 Spanish

## Permissions
Requires the following permissions:

* `tabs`: To query tabs and check for matching URLs
* `cookies`: To check that matching tabs are in the same cookie store (contextual identity support)
* `notifications`: To notify users when tabs are replaced or whitelist changes occur
* `storage`: To store extension settings and whitelist data
* `contextMenus`: To provide right-click tab menu functionality
* `activeTab`: For enhanced tab access and whitelist operations

## Technical Details

### Whitelist Logic
- **Domain matching**: `example.com` protects all subpages (`example.com/page1`, `example.com/page2`, etc.)
- **Exact URL matching**: `https://example.com/specific-page` protects only that exact URL
- **Priority**: Exact URL matches take precedence over domain matches
- **Special URLs**: Browser internal pages (`about:`, `chrome:`, extensions) are automatically excluded

### Duplicate Detection
- **URL matching**: Tabs with identical URLs in the same cookie store
- **Container awareness**: Respects Firefox Multi-Account Containers
- **Window scope**: Configurable single-window or multi-window checking
- **Protected tabs**: Newly created tabs are temporarily protected from removal

### Context Menu Behavior
- **Dynamic updates**: Menu reflects current tab state in real-time
- **Smart separators**: Only shows separators when needed to avoid clutter
- **Disabled states**: Whitelist options are disabled when whitelist is turned off
- **Duplicate navigation**: Click any duplicate tab in submenu to switch to it

## Development

### Building
This is a standard WebExtension. No build process required - load directly in Firefox developer mode.

### File Structure
```
├── manifest.json          # Extension manifest
├── background.js          # Core deduplication and whitelist logic
├── options.html           # Settings page UI
├── options.js             # Settings page functionality
├── i18n.js               # Internationalization helper
├── icon.svg              # Extension icon
└── _locales/             # Localization files
    ├── en/messages.json  # English
    ├── bg/messages.json  # Bulgarian
    └── es/messages.json  # Spanish
```

## Contributing
Contributions welcome! Please ensure:
- Code follows existing style
- New features include appropriate localization
- Context menu changes maintain usability
- Whitelist functionality respects user privacy

## License
See LICENSE file for details.