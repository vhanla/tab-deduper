/* stick all the options here so we can keep track of them */
let settings = {
	'protectDuplicates': true,
	'moveOlder': true,
	'checkMultiWindow': false,
	'enableWhitelist': false
};

/* list of tab IDs that should be protected from removal */
let blessedTabs = new Set();

/* whitelist storage - domains and exact URLs */
let whitelist = {
	domains: new Set(),
	exactUrls: new Set()
};

/* superscript numbers for duplicate count display */
const SUPERSCRIPT_NUMBERS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const WHITELIST_FLAG = '🎌'; // Flag for whitelisted sites with no duplicates
const DEDUPLICATION_ACTIVE = '🚦'; // Traffic light for non-whitelisted sites (deduplication active)
const WHITELIST_DISABLED = '🔴'; // Red circle for disabled whitelist
const WHITELIST_ENABLED = '🟢'; // Green circle for enabled whitelist

/* get superscript representation of a number */
let getSuperscript = (num) => {
	if (num === 0) return SUPERSCRIPT_NUMBERS[0];
	if (num > 99) return '⁹⁹⁺'; // Cap at 99+

	return num.toString().split('').map(digit => SUPERSCRIPT_NUMBERS[parseInt(digit)]).join('');
};

/* check if URL is a special URL that shouldn't be whitelisted */
let isSpecialUrl = (url) => {
	try {
		const urlObj = new URL(url);
		const specialProtocols = ['about:', 'chrome:', 'chrome-extension:', 'moz-extension:', 'edge:', 'opera:', 'vivaldi:', 'brave:'];
		return specialProtocols.some(protocol => urlObj.protocol === protocol);
	} catch (e) {
		return true; // If URL parsing fails, treat as special
	}
};

const TAB_QUERY_OPTIONS = {
	windowType: "normal"
};

let replaceTab = (replacedTab, replacementTab, discardedTabs) => {
	if (settings.moveOlder) {
		browser.tabs.move(replacementTab.id, { index: replacedTab.index, windowId: replacedTab.windowId });
	}

	/* don't focus backgrounded tabs */
	if (replacedTab.active) {
		browser.tabs.update(replacementTab.id, { active: replacedTab.active });
	}

	browser.notifications.create({
		"type": "basic",
		"title": browser.i18n.getMessage('notificationTitle'),
		"message": (replacedTab.url).toString()
	}).then(currentNotification => {
		setTimeout((notification) => {
			browser.notifications.clear(notification);
		}, 5000, currentNotification);
	});

	browser.tabs.remove(discardedTabs.map(tab => tab.id));
};

let getTabQuery = (url) => {
	const newURL = new URL(url);
	let filter;

	switch (newURL.protocol) {
		case 'about:':
			filter = {
				'url': `${newURL.protocol}*`
			};
			break;

		default:
			filter = {
				'url': `*://${newURL.hostname}/*`
			};
			break;
	}
	filter.currentWindow = settings.checkMultiWindow ? null : true;
	return Object.assign({}, TAB_QUERY_OPTIONS, filter);
}

let isWhitelisted = (url) => {
	if (!settings.enableWhitelist) {
		return false;
	}

	// Check exact URL match
	if (whitelist.exactUrls.has(url)) {
		return true;
	}

	// Check domain match
	try {
		const urlObj = new URL(url);
		return whitelist.domains.has(urlObj.hostname);
	} catch (e) {
		return false;
	}
};

let checkDuplicateTabs = async (newTab) => {
	if (newTab.id === browser.tabs.TAB_ID_NONE || blessedTabs.has(newTab.id) || isWhitelisted(newTab.url)) {
		return;
	}

	/* query to prefilter tabs */
	const tabQuery = getTabQuery(newTab.url);

	await browser.tabs.query(tabQuery).then(tabs => {
		/* return tabs with in the same session and the same URL (including current) */
		let copies = tabs.filter(tab => {
			return newTab.cookieStoreId === tab.cookieStoreId
				&& newTab.url === tab.url && !blessedTabs.has(tab.id);
		});

		if (copies.length > 1) {
			/* TODO handle priorities -- right now it keeps the older tab */
			copies.sort((a, b) => a.id - b.id);

			/* keep first tab, discard the rest */
			[keptTab, ...discarded] = copies;
			replaceTab(newTab, keptTab, discarded);
		}
	});
};

/* main routine */
browser.tabs.onUpdated.addListener((id, change, newTab) => {
	if (change.url && change.url !== 'about:blank') {
		checkDuplicateTabs(newTab);
	}
});

/* add protections to newly created tabs */
browser.tabs.onCreated.addListener(tab => {
	if ('openerTabId' in tab && tab.status === 'loading' && settings.protectDuplicates) {
		blessedTabs.add(tab.id);
	}
});

browser.tabs.onRemoved.addListener((id, info) => {
	blessedTabs.delete(id);
});

// Fallback: Update context menu when tabs change (for browsers without onShown support)
let lastActiveTab = null;

browser.tabs.onActivated.addListener(async (activeInfo) => {
	try {
		const tab = await browser.tabs.get(activeInfo.tabId);
		lastActiveTab = tab;

		// Update context menu for the newly active tab if onShown is not supported
		if (!browser.contextMenus.onShown) {
			await updateContextMenuForTab(tab);
		}
	} catch (e) {
		// Tab might not exist anymore
	}
});

// Update context menu when tabs change
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.url && tab.active) {
		lastActiveTab = tab;
		// Update context menu if onShown is not supported
		if (!browser.contextMenus.onShown) {
			await updateContextMenuForTab(tab);
		}
	}
});

browser.storage.onChanged.addListener(async (changes, areaName) => {
	/* extract just the new values so we can apply them to our options */
	let additions = {};
	Object.keys(changes).forEach((key) => additions[key] = changes[key].newValue);
	Object.assign(settings, additions);

	// Update whitelist if changed
	if (changes.whitelistDomains) {
		whitelist.domains = new Set(changes.whitelistDomains.newValue || []);
	}
	if (changes.whitelistExactUrls) {
		whitelist.exactUrls = new Set(changes.whitelistExactUrls.newValue || []);
	}

	/**
	 * wipe any 'protected' tabs if the option is disabled so they don't linger if another
	 * duplicate shows up
	 */
	if (!settings.protectDuplicates) {
		blessedTabs.clear();
	}
});

/* get duplicate tabs for a given tab */
let getDuplicateTabs = async (currentTab) => {
	const tabQuery = getTabQuery(currentTab.url);
	const tabs = await browser.tabs.query(tabQuery);

	return tabs.filter(tab => {
		return currentTab.cookieStoreId === tab.cookieStoreId
			&& currentTab.url === tab.url
			&& !blessedTabs.has(tab.id);
	});
};

/* update context menu for a specific tab */
let updateContextMenuForTab = async (tab) => {
	const url = tab.url;
	const isCurrentWhitelisted = isWhitelisted(url);
	const duplicates = await getDuplicateTabs(tab);
	const duplicateCount = duplicates.length;

	// Remove existing dynamic menus
	await browser.contextMenus.removeAll();

	// Create main Tab Deduper menu item with count/flag
	let mainTitle = "Tab Deduper";

	if (settings.enableWhitelist && isCurrentWhitelisted) {
		// Whitelisted sites: show superscript count if duplicates > 1, otherwise show flag
		if (duplicateCount > 1) {
			mainTitle += ` ${getSuperscript(duplicateCount)}`;
		} else {
			mainTitle += ` ${WHITELIST_FLAG}`;
		}
	} else {
		// Non-whitelisted sites or whitelist disabled: show traffic light emoji (deduplication active)
		mainTitle += ` ${DEDUPLICATION_ACTIVE}`;
	}

	browser.contextMenus.create({
		id: "tab-deduper-main",
		title: mainTitle,
		contexts: ["tab"]
	});

	// Track if we need separators
	let hasContentAbove = false;

	// Add duplicate tabs submenu if there are duplicates > 1 (for both whitelisted and non-whitelisted)
	if (duplicateCount > 1) {
		// Only add separator if there would be content above (there isn't any in this case)
		// So we don't add separator-duplicates here

		duplicates.forEach((dupTab, index) => {
			const isCurrentTab = dupTab.id === tab.id;
			const windowInfo = dupTab.windowId !== tab.windowId ? ` (Win ${dupTab.windowId})` : '';
			const prefix = isCurrentTab ? '→ ' : '  ';
			const title = `${prefix}${dupTab.title || 'Untitled'}${windowInfo}`;

			browser.contextMenus.create({
				id: `switch-to-tab-${dupTab.id}`,
				title: title.length > 60 ? title.substring(0, 57) + '...' : title,
				contexts: ["tab"],
				parentId: "tab-deduper-main",
				enabled: !isCurrentTab // Disable current tab item since you can't switch to yourself
			});
		});

		hasContentAbove = true;
	}

	// Check if this is a special URL that shouldn't have whitelist options
	const isSpecial = isSpecialUrl(url);

	if (!isSpecial) {
		// Check current whitelist status for domain and URL
		const domain = new URL(url).hostname;
		const isDomainWhitelisted = whitelist.domains.has(domain);
		const isUrlWhitelisted = whitelist.exactUrls.has(url);

		// Check if we have any whitelist options to show
		const hasWhitelistOptions = !isDomainWhitelisted || !isUrlWhitelisted || isDomainWhitelisted || isUrlWhitelisted;

		if (hasWhitelistOptions) {
			// Add separator only if there's content above
			if (hasContentAbove) {
				browser.contextMenus.create({
					id: "separator-whitelist-options",
					type: "separator",
					contexts: ["tab"],
					parentId: "tab-deduper-main"
				});
			}

			// Add whitelist options based on current state
			if (!isDomainWhitelisted) {
				browser.contextMenus.create({
					id: "whitelist-domain",
					title: `➕ ${browser.i18n.getMessage('whitelistDomain')}`,
					contexts: ["tab"],
					parentId: "tab-deduper-main",
					enabled: settings.enableWhitelist
				});
			}

			if (!isUrlWhitelisted) {
				browser.contextMenus.create({
					id: "whitelist-exact-url",
					title: `📌 ${browser.i18n.getMessage('whitelistExactUrl')}`,
					contexts: ["tab"],
					parentId: "tab-deduper-main",
					enabled: settings.enableWhitelist
				});
			}

			// Show remove option if either domain or URL is whitelisted
			if (isDomainWhitelisted || isUrlWhitelisted) {
				let removeTitle = browser.i18n.getMessage('removeFromWhitelist');
				if (isDomainWhitelisted && isUrlWhitelisted) {
					removeTitle = browser.i18n.getMessage('removeFromWhitelistBoth');
				} else if (isDomainWhitelisted) {
					removeTitle = browser.i18n.getMessage('removeFromWhitelistDomain');
				} else {
					removeTitle = browser.i18n.getMessage('removeFromWhitelistUrl');
				}

				browser.contextMenus.create({
					id: "remove-from-whitelist",
					title: `➖ ${removeTitle}`,
					contexts: ["tab"],
					parentId: "tab-deduper-main",
					enabled: settings.enableWhitelist
				});
			}

			hasContentAbove = true;
		}
	}

	// Add separator before settings only if there's content above
	if (hasContentAbove) {
		browser.contextMenus.create({
			id: "separator-settings",
			type: "separator",
			contexts: ["tab"],
			parentId: "tab-deduper-main"
		});
	}

	// Add whitelist toggle near settings
	const whitelistToggleTitle = `${settings.enableWhitelist ? WHITELIST_ENABLED : WHITELIST_DISABLED} ${browser.i18n.getMessage('enableWhitelistToggle')}`;
	browser.contextMenus.create({
		id: "toggle-whitelist",
		title: whitelistToggleTitle,
		contexts: ["tab"],
		parentId: "tab-deduper-main"
	});

	browser.contextMenus.create({
		id: "open-whitelist-settings",
		title: `🧰 ${browser.i18n.getMessage('openWhitelistSettings')}`,
		contexts: ["tab"],
		parentId: "tab-deduper-main"
	});
};

// Context menu setup - now dynamic
let createContextMenus = async () => {
	// Create a basic menu first, will be updated when right-clicked
	await browser.contextMenus.removeAll();
	browser.contextMenus.create({
		id: "tab-deduper-main",
		title: "Tab Deduper",
		contexts: ["tab"]
	});
};

// Context menu shown handler - update menu dynamically
if (browser.contextMenus.onShown) {
	browser.contextMenus.onShown.addListener(async (info, tab) => {
		if (tab && info.contexts.includes("tab")) {
			await updateContextMenuForTab(tab);
			if (browser.contextMenus.refresh) {
				browser.contextMenus.refresh();
			}
		}
	});
}

// Context menu click handler
browser.contextMenus.onClicked.addListener(async (info, tab) => {
	const url = tab.url;

	// Skip domain extraction for special URLs
	let domain = '';
	if (!isSpecialUrl(url)) {
		try {
			domain = new URL(url).hostname;
		} catch (e) {
			// If URL parsing fails, skip whitelist operations
			domain = '';
		}
	}

	// Handle switching to duplicate tabs
	if (info.menuItemId.startsWith('switch-to-tab-')) {
		const targetTabId = parseInt(info.menuItemId.replace('switch-to-tab-', ''));
		try {
			const targetTab = await browser.tabs.get(targetTabId);
			await browser.tabs.update(targetTabId, { active: true });
			await browser.windows.update(targetTab.windowId, { focused: true });
		} catch (e) {
			// Tab might have been closed
			console.log('Target tab no longer exists:', targetTabId);
		}
		return;
	}

	switch (info.menuItemId) {
		case "toggle-whitelist":
			settings.enableWhitelist = !settings.enableWhitelist;
			await browser.storage.sync.set({ enableWhitelist: settings.enableWhitelist });
			browser.notifications.create({
				type: "basic",
				title: browser.i18n.getMessage('whitelistToggleTitle'),
				message: browser.i18n.getMessage(settings.enableWhitelist ? 'whitelistEnabled' : 'whitelistDisabled')
			});
			break;

		case "whitelist-domain":
			if (domain && !isSpecialUrl(url)) {
				whitelist.domains.add(domain);
				await saveWhitelist();
				browser.notifications.create({
					type: "basic",
					title: browser.i18n.getMessage('whitelistAddedTitle'),
					message: browser.i18n.getMessage('whitelistDomainAdded', domain)
				});
			}
			break;

		case "whitelist-exact-url":
			if (!isSpecialUrl(url)) {
				whitelist.exactUrls.add(url);
				await saveWhitelist();
				browser.notifications.create({
					type: "basic",
					title: browser.i18n.getMessage('whitelistAddedTitle'),
					message: browser.i18n.getMessage('whitelistUrlAdded', url)
				});
			}
			break;

		case "remove-from-whitelist":
			if (!isSpecialUrl(url)) {
				let removed = false;
				let removedItems = [];
				if (domain && whitelist.domains.has(domain)) {
					whitelist.domains.delete(domain);
					removedItems.push('domain');
					removed = true;
				}
				if (whitelist.exactUrls.has(url)) {
					whitelist.exactUrls.delete(url);
					removedItems.push('URL');
					removed = true;
				}
				if (removed) {
					await saveWhitelist();
					browser.notifications.create({
						type: "basic",
						title: browser.i18n.getMessage('whitelistRemovedTitle'),
						message: browser.i18n.getMessage('whitelistRemovedItems', removedItems.join(' and '))
					});
				}
			}
			break;

		case "open-whitelist-settings":
			browser.runtime.openOptionsPage();
			break;
	}
});

// Whitelist storage functions
let saveWhitelist = async () => {
	await browser.storage.sync.set({
		whitelistDomains: Array.from(whitelist.domains),
		whitelistExactUrls: Array.from(whitelist.exactUrls)
	});
};

let loadWhitelist = async () => {
	const data = await browser.storage.sync.get(['whitelistDomains', 'whitelistExactUrls']);
	if (data.whitelistDomains) {
		whitelist.domains = new Set(data.whitelistDomains);
	}
	if (data.whitelistExactUrls) {
		whitelist.exactUrls = new Set(data.whitelistExactUrls);
	}
};

browser.storage.sync.get(null, async (data) => {
	Object.assign(settings, data);
	await loadWhitelist();
	createContextMenus();
});
